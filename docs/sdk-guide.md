# SDK Guide

This guide covers advanced usage and patterns for the GuildPass SDK.

## Error Handling

The SDK uses a custom `GuildPassError` class. You should always wrap SDK calls in try-catch blocks.

```typescript
import { GuildPassClient, GuildPassErrorCode } from "@guildpass/sdk";

try {
  await client.access.checkAccess({...});
} catch (error) {
  if (error instanceof GuildPassError) {
    switch (error.code) {
      case GuildPassErrorCode.UNAUTHORISED:
        // Handle invalid API key
        break;
      case GuildPassErrorCode.NOT_FOUND:
        // Handle missing guild or resource
        break;
      case GuildPassErrorCode.TIMEOUT:
        // Handle network timeout
        break;
      case GuildPassErrorCode.INVALID_RESPONSE:
        // Handle a malformed API response (only thrown when validateResponses is enabled)
        break;
    }
  }
}
```

## Environment Support

### Node.js

The SDK works in Node.js 18+. If you are on an older version, you may need to polyfill `fetch`.

### Browser

The SDK is tree-shakeable and optimized for modern browsers. It does not include any Node-only dependencies.

## Address Normalization and Checksums

The SDK automatically normalizes addresses to lowercase for consistency and accepts both lowercase and mixed-case addresses by default.
You can also use the exported utilities to format or strictly validate EIP-55 checksum addresses:

```typescript
import {
  normaliseAddress,
  toChecksumAddress,
  isChecksumAddress,
  validateAddress,
} from '@guildpass/sdk';

// Convert to lowercase
const clean = normaliseAddress('0xabc...');

// Convert to EIP-55 Checksum
const checksummed = toChecksumAddress('0xabc...');

// Check if an address has a valid checksum
const isValid = isChecksumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); // true

// Strict validation mode (throws if checksum is invalid)
validateAddress('0xd8da...', { strict: true });
```

## Timeouts

The default timeout is 10 seconds. You can override this globally or per request (in future versions):

```typescript
const client = new GuildPassClient({
  apiUrl: '...',
  timeoutMs: 5000, // 5 seconds
});
```

## Observability Hooks

The SDK supports optional request lifecycle hooks so you can integrate calls with logging, metrics, tracing, and debugging tools.

```typescript
const client = new GuildPassClient({
  apiUrl: 'https://api.guildpass.xyz',
  hooks: {
    onRequest: ({ method, path }) => {
      console.log('request started', method, path);
    },
    onResponse: ({ method, path, status, durationMs }) => {
      console.log('request succeeded', method, path, status, durationMs);
    },
    onError: ({ method, path, error, durationMs }) => {
      console.error('request failed', method, path, error.message, durationMs);
    },
  },
});
```

Hook payloads expose safe request metadata only. Sensitive values like the API key and full request body are not included in hook payloads, and hook failures are logged without changing the normal SDK response behavior.
