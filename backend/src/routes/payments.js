import { Router } from 'express';
import Stripe from 'stripe';
import env from '../config/env.js';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getIO } from '../sockets/index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get or create a Stripe customer for a user.
 * Looks up stripe_customer_id on the users table; if absent, creates a
 * new Stripe customer, persists the ID, and returns it.
 */
async function getOrCreateStripeCustomer(userId) {
  const userResult = await query(
    `SELECT id, email, phone, first_name, last_name, stripe_customer_id
     FROM users WHERE id = $1`,
    [userId],
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    phone: user.phone,
    name: `${user.first_name} ${user.last_name}`,
    metadata: { userId: user.id },
  });

  // Persist the Stripe customer ID
  await query(
    `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
    [customer.id, userId],
  );

  return customer.id;
}

// ---------------------------------------------------------------------------
// POST /setup-intent — Create a Stripe SetupIntent for saving cards
// ---------------------------------------------------------------------------
router.post(
  '/setup-intent',
  authenticate,
  async (req, res) => {
    try {
      const customerId = await getOrCreateStripeCustomer(req.user.id);

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return res.status(200).json({
        clientSecret: setupIntent.client_secret,
      });
    } catch (err) {
      console.error('[payments] POST /setup-intent error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the setup intent',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /payment-methods — Attach a payment method to user
// ---------------------------------------------------------------------------
router.post(
  '/payment-methods',
  authenticate,
  async (req, res) => {
    try {
      const { paymentMethodId } = req.body;

      if (!paymentMethodId || typeof paymentMethodId !== 'string') {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'paymentMethodId is required',
        });
      }

      const customerId = await getOrCreateStripeCustomer(req.user.id);

      // Attach the payment method to the Stripe customer
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Extract card details
      const cardBrand = paymentMethod.card?.brand || null;
      const cardLast4 = paymentMethod.card?.last4 || null;

      // Check if user has any existing payment methods
      const existingResult = await query(
        `SELECT id FROM payment_methods WHERE user_id = $1 LIMIT 1`,
        [req.user.id],
      );

      const isDefault = existingResult.rows.length === 0;

      // Insert into our database
      const result = await query(
        `INSERT INTO payment_methods
           (user_id, stripe_payment_method_id, card_brand, card_last4, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, stripe_payment_method_id, card_brand, card_last4,
                   is_default, created_at`,
        [req.user.id, paymentMethodId, cardBrand, cardLast4, isDefault],
      );

      const pm = result.rows[0];

      return res.status(201).json({
        paymentMethod: {
          id: pm.id,
          stripePaymentMethodId: pm.stripe_payment_method_id,
          cardBrand: pm.card_brand,
          cardLast4: pm.card_last4,
          isDefault: pm.is_default,
          createdAt: pm.created_at,
        },
      });
    } catch (err) {
      console.error('[payments] POST /payment-methods error:', err);

      // Handle Stripe-specific errors
      if (err.type === 'StripeCardError' || err.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: 'Payment method error',
          message: err.message,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while adding the payment method',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /payment-methods/:id — Remove a payment method
// ---------------------------------------------------------------------------
router.delete(
  '/payment-methods/:id',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify ownership and get the record
      const pmResult = await query(
        `SELECT id, stripe_payment_method_id, is_default
         FROM payment_methods
         WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );

      if (pmResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Payment method not found or you do not own it',
        });
      }

      const pm = pmResult.rows[0];

      // Detach from Stripe
      try {
        await stripe.paymentMethods.detach(pm.stripe_payment_method_id);
      } catch (stripeErr) {
        // If the PM is already detached in Stripe, log and continue
        console.warn('[payments] Stripe detach warning:', stripeErr.message);
      }

      // Delete from our database
      await query(
        `DELETE FROM payment_methods WHERE id = $1`,
        [id],
      );

      // If this was the default, set another card as default
      if (pm.is_default) {
        const nextDefault = await query(
          `SELECT id FROM payment_methods
           WHERE user_id = $1
           ORDER BY created_at ASC
           LIMIT 1`,
          [userId],
        );

        if (nextDefault.rows.length > 0) {
          await query(
            `UPDATE payment_methods SET is_default = true WHERE id = $1`,
            [nextDefault.rows[0].id],
          );
        }
      }

      return res.status(204).send();
    } catch (err) {
      console.error('[payments] DELETE /payment-methods/:id error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while removing the payment method',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /payment-methods/:id/default — Set a payment method as default
// ---------------------------------------------------------------------------
router.post(
  '/payment-methods/:id/default',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const pmResult = await query(
        `SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );

      if (pmResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Payment method not found or you do not own it',
        });
      }

      // Unset all defaults for this user
      await query(
        `UPDATE payment_methods SET is_default = false WHERE user_id = $1`,
        [userId],
      );

      // Set this one as default
      const result = await query(
        `UPDATE payment_methods SET is_default = true
         WHERE id = $1
         RETURNING id, user_id, stripe_payment_method_id, card_brand, card_last4,
                   is_default, created_at`,
        [id],
      );

      const pm = result.rows[0];

      return res.status(200).json({
        paymentMethod: {
          id: pm.id,
          stripePaymentMethodId: pm.stripe_payment_method_id,
          cardBrand: pm.card_brand,
          cardLast4: pm.card_last4,
          isDefault: pm.is_default,
          createdAt: pm.created_at,
        },
      });
    } catch (err) {
      console.error('[payments] POST /payment-methods/:id/default error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while setting the default payment method',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /charge — Charge a ride
// ---------------------------------------------------------------------------
router.post(
  '/charge',
  authenticate,
  async (req, res) => {
    try {
      const { rideId } = req.body;
      const userId = req.user.id;

      if (!rideId) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'rideId is required',
        });
      }

      // Get ride details and verify the passenger is the current user
      const rideResult = await query(
        `SELECT id, passenger_id, driver_id, fare_amount, platform_fee,
                driver_payout, status
         FROM rides
         WHERE id = $1`,
        [rideId],
      );

      if (rideResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Ride not found',
        });
      }

      const ride = rideResult.rows[0];

      if (ride.passenger_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not the passenger of this ride',
        });
      }

      if (ride.status !== 'completed') {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Ride must be completed before charging',
        });
      }

      // Check if a payment already exists for this ride
      const existingPayment = await query(
        `SELECT id FROM payments WHERE ride_id = $1 AND status IN ('completed', 'pending') LIMIT 1`,
        [rideId],
      );

      if (existingPayment.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A payment has already been created for this ride',
        });
      }

      // Get the user's default payment method
      const pmResult = await query(
        `SELECT stripe_payment_method_id
         FROM payment_methods
         WHERE user_id = $1 AND is_default = true
         LIMIT 1`,
        [userId],
      );

      if (pmResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'No default payment method found. Please add a payment method first.',
        });
      }

      const stripePaymentMethodId = pmResult.rows[0].stripe_payment_method_id;

      // Get or create the Stripe customer
      const customerId = await getOrCreateStripeCustomer(userId);

      // Convert amounts from dollars to cents for Stripe
      const fareAmountCents = Math.round(parseFloat(ride.fare_amount) * 100);
      const driverPayoutCents = Math.round(parseFloat(ride.driver_payout) * 100);

      // Create and confirm the PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: fareAmountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: stripePaymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          rideId: ride.id,
          passengerId: ride.passenger_id,
          driverId: ride.driver_id,
        },
      });

      // Get the driver's connected Stripe account for transfer
      let stripeTransferId = null;

      const driverResult = await query(
        `SELECT stripe_connect_account_id FROM users WHERE id = $1`,
        [ride.driver_id],
      );

      if (driverResult.rows.length > 0 && driverResult.rows[0].stripe_connect_account_id) {
        // Transfer the driver's payout to their connected account
        const transfer = await stripe.transfers.create({
          amount: driverPayoutCents,
          currency: 'usd',
          destination: driverResult.rows[0].stripe_connect_account_id,
          transfer_group: ride.id,
          metadata: {
            rideId: ride.id,
            driverId: ride.driver_id,
          },
        });
        stripeTransferId = transfer.id;
      }

      // Insert payment record
      const paymentResult = await query(
        `INSERT INTO payments
           (ride_id, passenger_id, driver_id, amount, platform_fee, driver_payout,
            payment_method, stripe_payment_id, stripe_transfer_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'card', $7, $8, $9)
         RETURNING id, ride_id, passenger_id, driver_id, amount, platform_fee,
                   driver_payout, tip_amount, payment_method, stripe_payment_id,
                   stripe_transfer_id, status, created_at`,
        [
          ride.id,
          ride.passenger_id,
          ride.driver_id,
          ride.fare_amount,
          ride.platform_fee,
          ride.driver_payout,
          paymentIntent.id,
          stripeTransferId,
          paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        ],
      );

      const payment = paymentResult.rows[0];

      return res.status(201).json({
        payment: {
          id: payment.id,
          rideId: payment.ride_id,
          passengerId: payment.passenger_id,
          driverId: payment.driver_id,
          amount: parseFloat(payment.amount),
          platformFee: parseFloat(payment.platform_fee),
          driverPayout: parseFloat(payment.driver_payout),
          tipAmount: parseFloat(payment.tip_amount),
          paymentMethod: payment.payment_method,
          stripePaymentId: payment.stripe_payment_id,
          stripeTransferId: payment.stripe_transfer_id,
          status: payment.status,
          createdAt: payment.created_at,
        },
      });
    } catch (err) {
      console.error('[payments] POST /charge error:', err);

      // Handle Stripe card errors
      if (err.type === 'StripeCardError') {
        return res.status(402).json({
          error: 'Payment failed',
          message: err.message,
          code: err.code,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the payment',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /refund — Refund a payment
// ---------------------------------------------------------------------------
router.post(
  '/refund',
  authenticate,
  async (req, res) => {
    try {
      const { paymentId, reason } = req.body;
      const userId = req.user.id;

      if (!paymentId) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'paymentId is required',
        });
      }

      // Get the payment and verify user is the passenger
      const paymentResult = await query(
        `SELECT p.id, p.ride_id, p.passenger_id, p.driver_id, p.amount,
                p.stripe_payment_id, p.status
         FROM payments p
         WHERE p.id = $1`,
        [paymentId],
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Payment not found',
        });
      }

      const payment = paymentResult.rows[0];

      if (payment.passenger_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not the passenger of this ride',
        });
      }

      if (payment.status !== 'completed') {
        return res.status(400).json({
          error: 'Bad request',
          message: `Cannot refund a payment with status '${payment.status}'`,
        });
      }

      if (!payment.stripe_payment_id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'No Stripe payment found for this record',
        });
      }

      // Create the Stripe refund
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_id,
        reason: reason === 'duplicate' ? 'duplicate' :
                reason === 'fraudulent' ? 'fraudulent' :
                'requested_by_customer',
        metadata: {
          paymentId: payment.id,
          rideId: payment.ride_id,
          reason: reason || 'Customer requested refund',
        },
      });

      // Update payment status
      await query(
        `UPDATE payments SET status = 'refunded' WHERE id = $1`,
        [paymentId],
      );

      return res.status(200).json({
        refund: {
          id: refund.id,
          paymentId: payment.id,
          amount: parseFloat(payment.amount),
          status: refund.status,
          reason: reason || null,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[payments] POST /refund error:', err);

      if (err.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: 'Refund failed',
          message: err.message,
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the refund',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /history — Payment history
// ---------------------------------------------------------------------------
router.get(
  '/history',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Count total payments for the user (as passenger or driver)
      const countResult = await query(
        `SELECT COUNT(*)::int AS total
         FROM payments
         WHERE passenger_id = $1 OR driver_id = $1`,
        [userId],
      );

      const total = countResult.rows[0].total;

      // Get paginated payments with ride details
      const paymentsResult = await query(
        `SELECT p.id, p.ride_id, p.passenger_id, p.driver_id,
                p.amount, p.platform_fee, p.driver_payout, p.tip_amount,
                p.payment_method, p.stripe_payment_id, p.status, p.created_at,
                r.pickup_address, r.dropoff_address, r.vehicle_type,
                r.actual_distance_km, r.actual_duration_min, r.dropoff_at
         FROM payments p
         JOIN rides r ON r.id = p.ride_id
         WHERE p.passenger_id = $1 OR p.driver_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limitNum, offset],
      );

      const payments = paymentsResult.rows.map((row) => ({
        id: row.id,
        rideId: row.ride_id,
        passengerId: row.passenger_id,
        driverId: row.driver_id,
        amount: parseFloat(row.amount),
        platformFee: parseFloat(row.platform_fee),
        driverPayout: parseFloat(row.driver_payout),
        tipAmount: parseFloat(row.tip_amount),
        paymentMethod: row.payment_method,
        status: row.status,
        createdAt: row.created_at,
        ride: {
          pickupAddress: row.pickup_address,
          dropoffAddress: row.dropoff_address,
          vehicleType: row.vehicle_type,
          actualDistanceKm: row.actual_distance_km ? parseFloat(row.actual_distance_km) : null,
          actualDurationMin: row.actual_duration_min,
          completedAt: row.dropoff_at,
        },
      }));

      return res.status(200).json({
        payments,
        total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (err) {
      console.error('[payments] GET /history error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching payment history',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /webhook — Stripe webhook handler (NO auth, needs raw body)
// ---------------------------------------------------------------------------
router.post(
  '/webhook',
  async (req, res) => {
    let event;

    try {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Missing Stripe signature header',
        });
      }

      // Verify the webhook signature
      // NOTE: req.body must be the raw Buffer for signature verification.
      // The main app should mount this route with express.raw() or the body
      // should be raw for this specific endpoint.
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('[payments] Webhook signature verification failed:', err.message);
      return res.status(400).json({
        error: 'Webhook error',
        message: 'Invalid signature',
      });
    }

    try {
      switch (event.type) {
        // -----------------------------------------------------------------
        // Payment succeeded
        // -----------------------------------------------------------------
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;

          await query(
            `UPDATE payments SET status = 'completed'
             WHERE stripe_payment_id = $1 AND status != 'completed'`,
            [paymentIntent.id],
          );

          console.log(`[payments] PaymentIntent succeeded: ${paymentIntent.id}`);
          break;
        }

        // -----------------------------------------------------------------
        // Payment failed
        // -----------------------------------------------------------------
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;

          await query(
            `UPDATE payments SET status = 'failed'
             WHERE stripe_payment_id = $1`,
            [paymentIntent.id],
          );

          // Notify the user of the failed payment
          const failedPayment = await query(
            `SELECT passenger_id, ride_id FROM payments
             WHERE stripe_payment_id = $1 LIMIT 1`,
            [paymentIntent.id],
          );

          if (failedPayment.rows.length > 0) {
            const io = getIO();
            if (io) {
              io.to(`user:${failedPayment.rows[0].passenger_id}`).emit('payment:failed', {
                rideId: failedPayment.rows[0].ride_id,
                message: paymentIntent.last_payment_error?.message || 'Payment failed',
              });
            }
          }

          console.log(`[payments] PaymentIntent failed: ${paymentIntent.id}`);
          break;
        }

        // -----------------------------------------------------------------
        // Stripe Connect account updated (driver account status)
        // -----------------------------------------------------------------
        case 'account.updated': {
          const account = event.data.object;

          // Update the driver's Stripe Connect status in our database
          if (account.id) {
            const chargesEnabled = account.charges_enabled;
            const payoutsEnabled = account.payouts_enabled;

            // Log the account update for auditing
            console.log(
              `[payments] Stripe account updated: ${account.id}, ` +
              `charges=${chargesEnabled}, payouts=${payoutsEnabled}`,
            );

            // If the driver has completed onboarding, we could update their profile
            if (chargesEnabled && payoutsEnabled) {
              await query(
                `UPDATE users
                 SET stripe_connect_status = 'active'
                 WHERE stripe_connect_account_id = $1`,
                [account.id],
              );
            }
          }
          break;
        }

        default:
          console.log(`[payments] Unhandled webhook event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[payments] Webhook handler error:', err);
      // Still return 200 to Stripe to prevent retries for handler errors
      return res.status(200).json({ received: true });
    }
  },
);

export default router;
