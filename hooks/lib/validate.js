'use strict';

// Generic schema validation helpers.
// Domain schemas define structure; this module checks it.

// All fields are implicitly nullable: null/undefined values skip type/enum checks.
// Schemas define type and enum constraints that apply only to non-null values.

function checkType(value, expectedType) {
  if (Array.isArray(expectedType)) {
    return expectedType.some(function (t) { return checkType(value, t); });
  }
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  return typeof value === expectedType;
}

function validateFields(obj, schema, prefix) {
  var errors = [];
  if (!obj || typeof obj !== 'object') {
    errors.push((prefix ? prefix + ': ' : '') + 'expected an object, got ' + typeof obj);
    return errors;
  }

  // Check required fields
  if (schema.required) {
    schema.required.forEach(function (field) {
      if (obj[field] === undefined || obj[field] === null) {
        errors.push((prefix ? prefix + '.' : '') + field + ' is required');
      }
    });
  }

  // Check requiredWhenPopulated: if any of these fields are non-null, all must be non-null
  if (schema.requiredWhenPopulated) {
    var hasAnyPopulated = schema.requiredWhenPopulated.some(function (field) {
      return obj[field] !== undefined && obj[field] !== null;
    });
    if (hasAnyPopulated) {
      schema.requiredWhenPopulated.forEach(function (field) {
        if (obj[field] === undefined || obj[field] === null) {
          errors.push((prefix ? prefix + '.' : '') + field + ' is required when checkpoint is populated');
        }
      });
    }
  }

  // Check field types and enums
  if (schema.fields) {
    Object.keys(schema.fields).forEach(function (field) {
      var spec = schema.fields[field];
      var value = obj[field];

      if (value === undefined || value === null) {
        return;
      }

      if (spec.type && !checkType(value, spec.type)) {
        errors.push(
          (prefix ? prefix + '.' : '') + field +
          ' must be type ' + (Array.isArray(spec.type) ? spec.type.join('|') : spec.type) +
          ', got ' + typeof value
        );
        return;
      }

      if (spec.enum && spec.enum.indexOf(value) === -1) {
        errors.push(
          (prefix ? prefix + '.' : '') + field +
          ' must be one of [' + spec.enum.join(', ') + '], got "' + value + '"'
        );
      }
    });
  }

  return errors;
}

function validateArrayItems(arr, itemSchema, arrayName) {
  var errors = [];
  if (!Array.isArray(arr)) return errors;

  arr.forEach(function (item, index) {
    var itemErrors = validateFields(item, { required: itemSchema.required, fields: itemSchema.fields }, arrayName + '[' + index + ']');
    errors = errors.concat(itemErrors);
  });

  return errors;
}

module.exports = { checkType: checkType, validateFields: validateFields, validateArrayItems: validateArrayItems };
