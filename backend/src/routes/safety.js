import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { triggerSOS, createTripShare, getSharedTrip, reportIncident } from '../services/safety.js';

const router = Router();

/**
 * POST /sos — Trigger emergency SOS
 */
router.post('/sos', authenticate, async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!rideId) {
      return res.status(400).json({ error: 'rideId is required' });
    }

    const result = await triggerSOS(req.user.id, rideId);
    res.json({
      message: 'Emergency alerts sent',
      alertsSent: result.alertsSent,
      incidentLogged: result.incidentLogged,
    });
  } catch (error) {
    console.error('[Safety] SOS trigger failed:', error.message);
    res.status(500).json({ error: 'Failed to trigger emergency alert' });
  }
});

/**
 * POST /share-trip — Create a trip share link
 */
router.post('/share-trip', authenticate, async (req, res) => {
  try {
    const { rideId, phone, email } = req.body;
    if (!rideId) {
      return res.status(400).json({ error: 'rideId is required' });
    }

    const share = await createTripShare(rideId, phone, email);
    res.status(201).json(share);
  } catch (error) {
    console.error('[Safety] Trip share failed:', error.message);
    res.status(500).json({ error: 'Failed to create trip share' });
  }
});

/**
 * GET /trip/:token — View a shared trip (public, no auth)
 */
router.get('/trip/:token', async (req, res) => {
  try {
    const trip = await getSharedTrip(req.params.token);
    if (!trip) {
      return res.status(404).json({ error: 'Trip share not found or expired' });
    }
    res.json(trip);
  } catch (error) {
    console.error('[Safety] Get shared trip failed:', error.message);
    res.status(500).json({ error: 'Failed to get trip info' });
  }
});

/**
 * POST /incidents — Report a safety incident
 */
router.post('/incidents', authenticate, async (req, res) => {
  try {
    const { rideId, incidentType, description } = req.body;
    if (!rideId || !incidentType) {
      return res.status(400).json({ error: 'rideId and incidentType are required' });
    }

    const incident = await reportIncident(rideId, req.user.id, incidentType, description);
    res.status(201).json({ incident });
  } catch (error) {
    console.error('[Safety] Incident report failed:', error.message);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

export default router;
