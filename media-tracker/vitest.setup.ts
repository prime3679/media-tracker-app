import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = webcrypto.randomUUID.bind(webcrypto);
}
