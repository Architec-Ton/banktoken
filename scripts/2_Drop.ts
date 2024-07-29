import { NetworkProvider } from '@ton/blueprint';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { Airdrop } from './highloadWallet';

export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);

    await Airdrop(provider, queryId, 'team.csv', 5n);
}