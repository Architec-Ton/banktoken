import "@stdlib/deploy";
// import "@stdlib/ownable";

import "./jetton/JettonMaster.tact";
import "./jetton/JettonWallet.tact";
import "./imports/message.tact"; 

contract BankJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, self.jetton_master);
    }
}

contract BankJetton with JettonMaster, Deployable{ //TODO  Ownable
    total_supply: Int as coins = 0;
    max_supply: Int as coins = 3_000_000;
    mintable: Bool = false;
    owner: Address;
    jetton_content: Cell;

    init(_owner: Address,_jetton_content: Cell){
        self.owner = _owner;
        self.jetton_content = _jetton_content;
        let ctx: Context = context();
        // todo  require (ctx.sender == self.minter, "not right minter");
        let msg: JettonMint = JettonMint{
            origin: _owner,
            receiver:_owner,
            amount: self.max_supply, 
            custom_payload: emptyCell(),
            forward_ton_amount: 0,
            forward_payload: emptySlice()
            };
        // self._mint_validate(ctx, msg);
        self._mint(ctx, msg);
    }

    override inline fun _mint_validate(ctx: Context, msg: JettonMint) {
        require(self.owner == ctx.sender, "JettonMaster: Sender is not a Jetton owner");
        require(self.mintable, "JettonMaster: Jetton is not mintable");
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, myAddress());
    }


}