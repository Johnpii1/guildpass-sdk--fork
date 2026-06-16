// GuildPass SDK: Import external module dependencies.
import { HttpHooks } from '../http/http.types';

// GuildPass SDK: Exported component definition.
export type GuildPassClientConfig = {
  apiUrl: string;
  chainId?: number;
  rpcUrl?: string;
  contractAddress?: string;
  apiKey?: string;
  timeoutMs?: number;
  hooks?: HttpHooks;
  // GuildPass SDK: End of logic containment structure block.
};
