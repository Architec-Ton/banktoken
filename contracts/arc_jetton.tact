import "@stdlib/deploy";
import "@stdlib/ownable";
import "./jetton/JettonMaster.tact";
import "./jetton/JettonWallet.tact";
import "./imports/message.tact"; 
import "./stake_storage.tact";

contract ArcJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf ArcJettonWallet(owner_address, self.jetton_master);
    }
}



contract ArcJetton with JettonMaster, Deployable, OwnableTransferable {
    total_supply: Int as coins = 0;
    mintable: Bool = true;
    owner: Address;
    minter: Address;
    
    jetton_content: Cell;

    init(_owner: Address, _jetton_content: Cell){
        self.owner = _owner;
        self.minter = _owner;
        self.jetton_content = _jetton_content;
    }
  
    receive (_msg: ChangeMinter) {
        require (context().sender == self.owner, "Not right owner ");
        self.minter = _msg.newMinter;
    }

    receive(_msg: Mint) {
        let ctx: Context = context();
        // dump("ARC MINT");
        // dump(_msg.amount);
        require (ctx.sender == self.minter, "not right minter");
        let msg: JettonMint = JettonMint{
            origin: _msg.to,
            receiver:_msg.to,
            amount: _msg.amount,
            custom_payload: emptyCell(),
            forward_ton_amount: 0,
            forward_payload: emptySlice()
        };
        self._mint_validate(ctx, msg);
        self._mint(ctx, msg);
    }

    override inline fun _mint_validate(ctx: Context, msg: JettonMint) {
        require(self.mintable, "JettonMaster: Jetton is not mintable");
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf ArcJettonWallet(owner_address, myAddress());
    }
    
}