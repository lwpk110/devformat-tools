import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';

function requiredEnvironment(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requestHeaders(apiToken, includeJson = false) {
  return {
    authorization: `Bearer ${apiToken}`,
    ...(includeJson ? { 'content-type': 'application/json' } : {}),
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`Cloudflare API returned invalid JSON with HTTP ${response.status}`);
  }
}

function validateProject(payload, projectName, productionBranch) {
  const project = payload?.result;
  if (
    payload?.success !== true ||
    project?.name !== projectName ||
    project?.production_branch !== productionBranch
  ) {
    throw new Error('Cloudflare Pages project does not match expected configuration');
  }
  return project;
}

async function queryProject(collectionUrl, projectName, apiToken, fetchImpl) {
  return fetchImpl(`${collectionUrl}/${encodeURIComponent(projectName)}`, {
    headers: requestHeaders(apiToken),
  });
}

export async function ensurePagesProject(config, { fetchImpl = fetch } = {}) {
  const { accountId, apiToken, projectName, productionBranch } = config;
  const collectionUrl = `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/pages/projects`;
  const query = await queryProject(collectionUrl, projectName, apiToken, fetchImpl);

  if (query.status === 200) {
    return {
      state: 'existing',
      project: validateProject(await readJson(query), projectName, productionBranch),
    };
  }
  if (query.status !== 404) {
    throw new Error(`Cloudflare Pages project query failed with HTTP ${query.status}`);
  }

  const create = await fetchImpl(collectionUrl, {
    method: 'POST',
    headers: requestHeaders(apiToken, true),
    body: JSON.stringify({ name: projectName, production_branch: productionBranch }),
  });
  if (create.ok) {
    return {
      state: 'created',
      project: validateProject(await readJson(create), projectName, productionBranch),
    };
  }
  if (create.status !== 409) {
    throw new Error(`Cloudflare Pages project creation failed with HTTP ${create.status}`);
  }

  // 首次多分支部署可能同时观察到 404；仅并发冲突时重查，不覆盖资源。
  const afterCreate = await queryProject(collectionUrl, projectName, apiToken, fetchImpl);
  if (afterCreate.status === 200) {
    return {
      state: 'existing-after-race',
      project: validateProject(
        await readJson(afterCreate),
        projectName,
        productionBranch,
      ),
    };
  }
  throw new Error(
    `Cloudflare Pages project race query failed with HTTP ${afterCreate.status}`,
  );
}

export async function runFromEnvironment(env = process.env, fetchImpl = fetch) {
  return ensurePagesProject(
    {
      accountId: requiredEnvironment(env, 'CLOUDFLARE_ACCOUNT_ID'),
      apiToken: requiredEnvironment(env, 'CLOUDFLARE_API_TOKEN'),
      projectName: requiredEnvironment(env, 'CLOUDFLARE_PAGES_PROJECT'),
      productionBranch: requiredEnvironment(
        env,
        'CLOUDFLARE_PAGES_PRODUCTION_BRANCH',
      ),
    },
    { fetchImpl },
  );
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  runFromEnvironment()
    .then(({ state, project }) => {
      console.log(`Cloudflare Pages project ready: ${project.name} (${state})`);
    })
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : 'Cloudflare Pages initialization failed',
      );
      process.exitCode = 1;
    });
}
