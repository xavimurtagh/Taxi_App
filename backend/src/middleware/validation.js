/**
 * Generic Joi validation middleware factory.
 *
 * @param {import('joi').Schema} schema   - Joi schema to validate against
 * @param {'body'|'query'|'params'} property - Which part of the request to validate
 * @returns {Function} Express middleware
 */
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    // Replace the request property with the sanitised/converted value
    req[property] = value;
    next();
  };
}
