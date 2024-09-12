import { NetworkProvider } from '@ton/blueprint';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { Airdrop } from './highloadWallet';

export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 1n);

    await Airdrop(provider, queryId, '0_test_team.csv'); // add param  "5n" - if no banks in file and sum equal to each over 
}