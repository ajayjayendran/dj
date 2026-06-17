import { describe, expect, test, beforeEach } from '@jest/globals';
import type { DbtProject } from '@shared/dbt/types';

/**
 * Unit tests for Dbt.pruneDeletedModels behaviour.
 *
 * Because instantiating the real Dbt class requires VS Code APIs, we create a
 * minimal stand-in that reproduces the data structures and the pruning logic.
 * If the implementation in dbt.ts changes, keep this in sync.
 */

function createProject(
  name: string,
  nodes: Record<string, { name: string; resource_type?: 'model' | 'seed' | 'test' }>,
): DbtProject {
  return {
    name,
    macroPaths: [],
    manifest: {
      child_map: {},
      disabled: {},
      docs: {},
      exposures: {},
      group_map: {},
      groups: {},
      macros: {},
      metadata: { project_name: name },
      metrics: {},
      nodes,
      parent_map: {},
      saved_queries: {},
      selectors: {},
      semantic_models: {},
      sources: {},
    },
    modelPaths: ['models'],
    packagePath: '',
    pathRelative: '',
    pathSystem: '',
    properties: {},
    targetPath: 'target',
    variables: {},
  };
}

/**
 * Minimal replica of `Dbt.pruneDeletedModels` for unit testing.
 * Mirrors the implementation in src/services/dbt.ts.
 */
function pruneDeletedModels(
  projects: Map<string, DbtProject>,
  models: Map<string, unknown>,
  seeds: Map<string, unknown>,
  modelTreeRoots: Map<string, unknown>,
  projectName: string,
  modelNames: string[],
): void {
  const project = projects.get(projectName);
  if (!project?.manifest?.nodes) {
    return;
  }

  const prunedNodes = { ...project.manifest.nodes };
  let didPrune = false;

  for (const name of modelNames) {
    const modelNodeId = `model.${projectName}.${name}`;
    const seedNodeId = `seed.${projectName}.${name}`;

    if (modelNodeId in prunedNodes) {
      delete prunedNodes[modelNodeId];
      models.delete(modelNodeId);
      modelTreeRoots.delete(name);
      didPrune = true;
    }
    if (seedNodeId in prunedNodes) {
      delete prunedNodes[seedNodeId];
      seeds.delete(seedNodeId);
      didPrune = true;
    }
  }

  if (didPrune) {
    projects.set(projectName, {
      ...project,
      manifest: { ...project.manifest, nodes: prunedNodes },
    });
  }
}

describe('pruneDeletedModels', () => {
  let projects: Map<string, DbtProject>;
  let models: Map<string, unknown>;
  let seeds: Map<string, unknown>;
  let modelTreeRoots: Map<string, unknown>;

  beforeEach(() => {
    projects = new Map();
    models = new Map();
    seeds = new Map();
    modelTreeRoots = new Map();
  });

  test('removes a model node from the manifest and models map', () => {
    const proj = createProject('my_project', {
      'model.my_project.stg_orders': {
        name: 'stg_orders',
        resource_type: 'model',
      },
      'model.my_project.stg_customers': {
        name: 'stg_customers',
        resource_type: 'model',
      },
    });
    projects.set('my_project', proj);
    models.set('model.my_project.stg_orders', { name: 'stg_orders' });
    models.set('model.my_project.stg_customers', { name: 'stg_customers' });
    modelTreeRoots.set('stg_orders', { id: 'model.my_project.stg_orders' });

    pruneDeletedModels(
      projects,
      models,
      seeds,
      modelTreeRoots,
      'my_project',
      ['stg_orders'],
    );

    const updated = projects.get('my_project')!;
    expect('model.my_project.stg_orders' in updated.manifest.nodes).toBe(
      false,
    );
    expect('model.my_project.stg_customers' in updated.manifest.nodes).toBe(
      true,
    );
    expect(models.has('model.my_project.stg_orders')).toBe(false);
    expect(models.has('model.my_project.stg_customers')).toBe(true);
    expect(modelTreeRoots.has('stg_orders')).toBe(false);
  });

  test('removes a seed node from the manifest and seeds map', () => {
    const proj = createProject('my_project', {
      'seed.my_project.seed_data': {
        name: 'seed_data',
        resource_type: 'seed',
      },
    });
    projects.set('my_project', proj);
    seeds.set('seed.my_project.seed_data', { name: 'seed_data' });

    pruneDeletedModels(
      projects,
      models,
      seeds,
      modelTreeRoots,
      'my_project',
      ['seed_data'],
    );

    const updated = projects.get('my_project')!;
    expect('seed.my_project.seed_data' in updated.manifest.nodes).toBe(false);
    expect(seeds.has('seed.my_project.seed_data')).toBe(false);
  });

  test('no-op when model name does not exist in manifest', () => {
    const proj = createProject('my_project', {
      'model.my_project.existing_model': {
        name: 'existing_model',
        resource_type: 'model',
      },
    });
    projects.set('my_project', proj);

    pruneDeletedModels(
      projects,
      models,
      seeds,
      modelTreeRoots,
      'my_project',
      ['nonexistent_model'],
    );

    const updated = projects.get('my_project')!;
    expect(
      'model.my_project.existing_model' in updated.manifest.nodes,
    ).toBe(true);
  });

  test('no-op when project does not exist', () => {
    pruneDeletedModels(
      projects,
      models,
      seeds,
      modelTreeRoots,
      'nonexistent_project',
      ['some_model'],
    );

    expect(projects.size).toBe(0);
  });

  test('handles multiple model deletions at once', () => {
    const proj = createProject('proj', {
      'model.proj.a': { name: 'a', resource_type: 'model' },
      'model.proj.b': { name: 'b', resource_type: 'model' },
      'model.proj.c': { name: 'c', resource_type: 'model' },
    });
    projects.set('proj', proj);
    models.set('model.proj.a', {});
    models.set('model.proj.b', {});
    models.set('model.proj.c', {});

    pruneDeletedModels(projects, models, seeds, modelTreeRoots, 'proj', [
      'a',
      'b',
    ]);

    const updated = projects.get('proj')!;
    expect(Object.keys(updated.manifest.nodes)).toEqual(['model.proj.c']);
    expect(models.size).toBe(1);
    expect(models.has('model.proj.c')).toBe(true);
  });

  test('does not mutate the original project reference', () => {
    const proj = createProject('proj', {
      'model.proj.model_x': { name: 'model_x', resource_type: 'model' },
    });
    projects.set('proj', proj);
    const originalNodes = proj.manifest.nodes;

    pruneDeletedModels(projects, models, seeds, modelTreeRoots, 'proj', [
      'model_x',
    ]);

    // The original project object should be untouched; a new reference is stored
    expect('model.proj.model_x' in originalNodes).toBe(true);
    const updated = projects.get('proj')!;
    expect(updated).not.toBe(proj);
    expect('model.proj.model_x' in updated.manifest.nodes).toBe(false);
  });
});
