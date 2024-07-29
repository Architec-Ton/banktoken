import { Address, Dictionary, DictionaryKey, DictionaryValue } from '@ton/core';

export function getMultisig() {
    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    const owner1Address = Address.parse(process.env.OWNER_1_ADDRESS!);
    const owner2Address = Address.parse(process.env.OWNER_2_ADDRESS!);
    const owner3Address = Address.parse(process.env.OWNER_3_ADDRESS!);
    const owner4Address = Address.parse(process.env.OWNER_4_ADDRESS!);

    members.set(owner1Address, 1n);
    members.set(owner2Address, 1n);
    members.set(owner3Address, 1n);
    members.set(owner4Address, 1n);

    return members
}
