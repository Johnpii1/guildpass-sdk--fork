// Compile-only check (no emit) that the published declaration file resolves
// the way a downstream consumer would import it via package.json#types
// (dist/index.d.ts). This file is never executed; `tsc -p tsconfig.smoke.json`
// failing to compile it is the signal that the published types are broken.
import {
  GuildPassClient,
  GuildPassError,
  GuildPassErrorCode,
  type GuildPassClientConfig,
  type NetworkConfig,
} from '../../dist/index';

const config: GuildPassClientConfig = {
  apiUrl: 'https://smoke-test.invalid',
};

const client: GuildPassClient = new GuildPassClient(config);
const code: GuildPassErrorCode = GuildPassErrorCode.NOT_FOUND;
const error: GuildPassError = new GuildPassError('smoke test', code);
const network: NetworkConfig = {
  chainId: 1,
  name: 'smoke-network',
};

void client;
void error;
void network;
