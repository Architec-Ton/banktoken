import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/stake_storage.tact',
    options: {
        debug: true, // ← that's the stuff!
      }
};
