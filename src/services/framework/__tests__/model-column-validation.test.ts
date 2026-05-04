import { describe, expect, test } from '@jest/globals';
import { validateModelColumnReferences } from '@services/modelValidation';

import { createTestProject } from './helpers';

describe('validateModelColumnReferences', () => {
  const projectWithColumns = createTestProject({
    nodes: {
      ['model.project.stg_customers']: {
        columns: {
          customer_id: {
            name: 'customer_id',
            data_type: 'varchar',
            meta: { type: 'dim' },
          },
          customer_name: {
            name: 'customer_name',
            data_type: 'varchar',
            meta: { type: 'dim' },
          },
          email: {
            name: 'email',
            data_type: 'varchar',
            meta: { type: 'dim' },
          },
          total_orders: {
            name: 'total_orders',
            data_type: 'bigint',
            meta: { type: 'fct' },
          },
          revenue: {
            name: 'revenue',
            data_type: 'double',
            meta: { type: 'fct' },
          },
        },
      },
    },
    sources: {
      ['source.project.raw.orders']: {
        columns: {
          order_id: {
            name: 'order_id',
            data_type: 'varchar',
            meta: { type: 'dim' },
          },
          order_amount: {
            name: 'order_amount',
            data_type: 'double',
            meta: { type: 'fct' },
          },
          created_at: {
            name: 'created_at',
            data_type: 'timestamp',
            meta: { type: 'dim' },
          },
        },
      },
    },
  });

  describe('all_from_model validation', () => {
    test('no errors for valid include', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            include: ['customer_id', 'customer_name'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('reports error for non-existent column in include', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            include: ['customer_nam'], // typo
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('customer_nam');
      expect(errors[0].message).toContain('does not exist');
      expect(errors[0].message).toContain('stg_customers');
      expect(errors[0].instancePath).toContain('include');
    });

    test('reports error for non-existent column in exclude', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            exclude: ['nonexistent_col'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('nonexistent_col');
      expect(errors[0].message).toContain('does not exist');
    });

    test('reports multiple errors for multiple invalid columns', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            include: ['bad_col_1', 'bad_col_2'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors[0].message).toContain('bad_col_1');
      expect(errors[1].message).toContain('bad_col_2');
    });

    test('reports error when exclude/include results in zero columns', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            exclude: [
              'customer_id',
              'customer_name',
              'email',
              'total_orders',
              'revenue',
            ],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.some((e) => e.message.includes('zero columns'))).toBe(true);
    });
  });

  describe('dims_from_model validation', () => {
    test('no errors for valid dim column in include', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'dims_from_model',
            model: 'stg_customers',
            include: ['customer_id', 'customer_name'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('reports error for fct column in dims_from_model include (type narrowing)', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'dims_from_model',
            model: 'stg_customers',
            include: ['revenue'], // fct column, not dim
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('revenue');
      expect(errors[0].message).toContain('not a dimension column');
    });

    test('reports error for non-existent column in dims_from_model include', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'dims_from_model',
            model: 'stg_customers',
            include: ['ghost_column'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('ghost_column');
      expect(errors[0].message).toContain('does not exist');
    });
  });

  describe('fcts_from_model validation', () => {
    test('no errors for valid fct column in include', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'fcts_from_model',
            model: 'stg_customers',
            include: ['total_orders', 'revenue'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('reports error for dim column in fcts_from_model include (type narrowing)', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'fcts_from_model',
            model: 'stg_customers',
            include: ['customer_id'], // dim column, not fct
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('customer_id');
      expect(errors[0].message).toContain('not a fact column');
    });
  });

  describe('all_from_source validation', () => {
    test('no errors for valid source column in include', () => {
      const modelJson = {
        type: 'stg_select_source',
        from: { source: 'raw.orders' },
        select: [
          {
            type: 'all_from_source',
            source: 'raw.orders',
            include: ['order_id', 'order_amount'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('reports error for non-existent column in source include', () => {
      const modelJson = {
        type: 'stg_select_source',
        from: { source: 'raw.orders' },
        select: [
          {
            type: 'all_from_source',
            source: 'raw.orders',
            include: ['order_amnt'], // typo
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('order_amnt');
      expect(errors[0].message).toContain('does not exist');
      expect(errors[0].message).toContain('raw.orders');
    });

    test('reports error for non-existent column in source exclude', () => {
      const modelJson = {
        type: 'stg_select_source',
        from: { source: 'raw.orders' },
        select: [
          {
            type: 'all_from_source',
            source: 'raw.orders',
            exclude: ['bad_column'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('bad_column');
      expect(errors[0].message).toContain('does not exist');
    });
  });

  describe('CTE with *_from_model validation', () => {
    test('validates *_from_model inside CTE select', () => {
      const modelJson = {
        type: 'int_select_model',
        ctes: [
          {
            name: 'enriched',
            from: { model: 'stg_customers' },
            select: [
              {
                type: 'all_from_model',
                model: 'stg_customers',
                include: ['typo_column'],
              },
            ],
          },
        ],
        from: { cte: 'enriched' },
        select: [{ type: 'all_from_cte', cte: 'enriched' }],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('typo_column');
      expect(errors[0].message).toContain('enriched');
    });

    test('no errors for valid CTE with *_from_model', () => {
      const modelJson = {
        type: 'int_select_model',
        ctes: [
          {
            name: 'enriched',
            from: { model: 'stg_customers' },
            select: [
              {
                type: 'dims_from_model',
                model: 'stg_customers',
                include: ['customer_id', 'email'],
              },
            ],
          },
        ],
        from: { cte: 'enriched' },
        select: [{ type: 'all_from_cte', cte: 'enriched' }],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('returns no errors when project has no manifest', () => {
      const projectNoManifest = {
        ...projectWithColumns,
        manifest: null as any,
      };
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          {
            type: 'all_from_model',
            model: 'stg_customers',
            include: ['typo'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectNoManifest,
      );
      expect(errors).toHaveLength(0);
    });

    test('returns no errors when model has no select array', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('returns no errors for non-bulk select items', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'stg_customers' },
        select: [
          { name: 'customer_id', type: 'dim' },
          { name: 'total', expr: 'sum(revenue)', type: 'fct' },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });

    test('skips validation for model not in manifest (no columns)', () => {
      const modelJson = {
        type: 'int_select_model',
        from: { model: 'unknown_model' },
        select: [
          {
            type: 'all_from_model',
            model: 'unknown_model',
            include: ['anything'],
          },
        ],
      };
      const errors = validateModelColumnReferences(
        modelJson,
        projectWithColumns,
      );
      expect(errors).toHaveLength(0);
    });
  });
});
