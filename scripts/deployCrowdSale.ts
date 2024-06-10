import { Address, beginCell, Cell, Slice, toNano } from '@ton/ton';
import { CrowdSale } from '../wrappers/CrowdSale';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    let unlockDate = 0n; //UnixTime
    let owner = Address.parse('UQAsB6vBUeSPdQ_XnIrTt8psWXpxdcJmCKVgyuDQYr8B2HQg');

    const crowdSale = provider.open(
        await CrowdSale.fromInit(
            unlockDate, //: Int,
            // owner, //: Address */
        ),
    );

    await crowdSale.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(crowdSale.address);

    console.log('address', crowdSale.address);

    // run methods on `crowdSale`
}
