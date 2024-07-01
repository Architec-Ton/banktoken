import { Sha256 } from "@aws-crypto/sha256-js";
import { beginCell, Cell } from "@ton/ton";
import {Address, Dictionary, toNano} from "@ton/core";
import {JettonTransfer} from "../build/ArcJetton/tact_ArcJetton";

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

function bufferToChunks(buff: Buffer, chunkSize: number) {
    let chunks: Buffer[] = [];
    while (buff.byteLength > 0) {
        chunks.push(buff.slice(0, chunkSize));
        buff = buff.slice(chunkSize);
    }
    return chunks;
}

export function makeSnakeCell(data: Buffer) {
    let chunks = bufferToChunks(data, CELL_MAX_SIZE_BYTES);
    const b = chunks.reduceRight((curCell, chunk, index) => {
        if (index === 0) {
            curCell.storeInt(SNAKE_PREFIX, 8);
        }
        curCell.storeBuffer(chunk);
        if (index > 0) {
            const cell = curCell.endCell();
            return beginCell().storeRef(cell);
        } else {
            return curCell;
        }
    }, beginCell());
    return b.endCell();
}

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
};

const toKey = (key: string) => {
    return BigInt(`0x${sha256(key).toString("hex")}`);
};

export function buildOnchainMetadata(data: {
    name: string;
    description: string;
    image: string;
}): Cell {
    let dict = Dictionary.empty(
        Dictionary.Keys.BigUint(256),
        Dictionary.Values.Cell()
    );
    Object.entries(data).forEach(([key, value]) => {
        dict.set(toKey(key), makeSnakeCell(Buffer.from(value, "utf8")));
    });

    return beginCell()
        .storeInt(ONCHAIN_CONTENT_PREFIX, 8)
        .storeDict(dict)
        .endCell();
}

export function getJettonTransferBuilder(address: Address, amount: bigint | number, response_address: Address=address, decimal: boolean = true): JettonTransfer {
    return {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: decimal ? toNano(amount) : BigInt(amount),
        destination: address,
        response_destination: response_address,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell(),
    }
}