import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/bank_staking.tact',
    options: {
        debug: true, // ← that's the stuff!
      }
};
