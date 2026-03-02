import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import {
  getActiveVehicleTypes,
  getVehicleType,
  getAccessibleVehicleTypes,
} from '../services/vehicleTypes.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET / — List all active vehicle types (public)
// ---------------------------------------------------------------------------
router.get('/', optionalAuth, async (_req, res) => {
  try {
    const vehicleTypes = await getActiveVehicleTypes();

    return res.status(200).json({ vehicleTypes });
  } catch (err) {
    console.error('[vehicleTypes] GET / error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching vehicle types',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /accessible — List vehicle types that support accessibility features
// ---------------------------------------------------------------------------
router.get('/accessible', optionalAuth, async (_req, res) => {
  try {
    const vehicleTypes = await getAccessibleVehicleTypes();

    return res.status(200).json({ vehicleTypes });
  } catch (err) {
    console.error('[vehicleTypes] GET /accessible error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching accessible vehicle types',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:typeKey — Get a single vehicle type by key (public)
// ---------------------------------------------------------------------------
router.get('/:typeKey', optionalAuth, async (req, res) => {
  try {
    const { typeKey } = req.params;

    const vehicleType = await getVehicleType(typeKey);

    if (!vehicleType) {
      return res.status(404).json({
        error: 'Not found',
        message: `Vehicle type '${typeKey}' not found or is not currently active`,
      });
    }

    return res.status(200).json({ vehicleType });
  } catch (err) {
    console.error('[vehicleTypes] GET /:typeKey error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the vehicle type',
    });
  }
});

export default router;
