import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/arc_jetton.tact',
    // options: {
    //     debug: true, // ← that's the stuff!
    //   }
};
