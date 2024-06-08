import { toNano } from '@ton/core';
import { Storage } from '../wrappers/Storage';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const storage = provider.open(await Storage.fromInit(BigInt(Math.floor(Math.random() * 10000))));

    await storage.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(storage.address);

    console.log('ID', await storage.getId());
}
