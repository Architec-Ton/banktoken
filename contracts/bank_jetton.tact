import "@stdlib/deploy";
import "@stdlib/ownable";
import "./jetton/JettonMaster.tact";
import "./jetton/JettonWallet.tact";
import "./imports/message.tact"; 
import "./stake_storage.tact";

contract BankJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    receive (_stake: Stake) {
        let ctx: Context = context();
        // dump("Stake");
        // dump (ctx.sender);
        let msg: JettonTransfer = JettonTransfer{
                query_id: _stake.query_id,
                amount: _stake.amount,
                destination:  self.jetton_master,
                response_destination:   self.jetton_master,
                custom_payload: null,
                forward_ton_amount:ton("1"),
                forward_payload: emptySlice()
        };
        self._transfer_jetton (ctx, msg);
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, self.jetton_master);
    }
}

contract BankJetton with JettonMaster, Deployable,  Ownable{ 
    total_supply: Int as coins = 0;
    max_supply: Int as coins = ton("3000000");
    mintable: Bool = false;
    owner: Address;
    jetton_content: Cell;
    firstCell:Address;
    lastCell:Address;
    ARCjetton: Address;


    init(_owner: Address,_jetton_content: Cell){
        self.owner = _owner;
        self.jetton_content = _jetton_content;
        let ctx: Context = context();
        self.firstCell = newAddress(0,0);
        self.lastCell = newAddress(0,0);
        self.ARCjetton = newAddress(0,0);
        let msg: JettonMint = JettonMint{
            origin: _owner,
            receiver:_owner,
            amount: self.max_supply, 
            custom_payload: emptyCell(),
            forward_ton_amount: 0,
            forward_payload: emptySlice()
            };
        self._mint(ctx, msg);
        self.mintable = false;
    }

    receive (_msg: AddingJettonAddress ) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "No right to  AddingJettonAddress");
        self.ARCjetton = _msg.this_contract_jettonWallet;
    }


    receive(stake: JettonTransferNotification){
        let ctx: Context = context();
        let walletBNKAddress: Address = contractAddress(self.calculate_jetton_wallet_init(myAddress()));
        require(ctx.sender == walletBNKAddress, "Not right sender of stake message"); //waiting response from own wallet
        let stakeInit: StateInit =initOf StakeStorage (stake.sender, myAddress()); //initOf StakeStorage(stake.sender, myAddress());
        // init iterator if need
        if (self.firstCell ==  newAddress(0, 0)) {
            self.firstCell = contractAddress(stakeInit);}
        if (self.lastCell ==  newAddress(0, 0)) {
            self.lastCell = contractAddress(stakeInit);}
        //send stake info
        send(SendParameters{
            to: contractAddress(stakeInit),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body:Add {
                queryId: stake.query_id, //Int as uint64;
                amount:  stake.amount, //Int as uint32;
                stakerWallet: ctx.sender,  
                previousCell: self.lastCell, // Address;
                nextCell: self.firstCell // Address;
            }.toCell(),
            code: stakeInit.code,
            data: stakeInit.data
        });

        send(SendParameters{
            to: self.lastCell,
            value: 1,
            mode: SendRemainingValue  + SendIgnoreErrors,
            bounce: false,
            body:UpdateNext {
                nextCell: contractAddress(stakeInit) // Address;
            }.toCell()
        });
        self.lastCell = contractAddress(stakeInit);

        let sendBNKmsg: JettonTransfer = JettonTransfer{
                query_id: stake.query_id,
                amount: stake.amount,
                destination:  contractAddress(stakeInit),
                response_destination:   contractAddress(stakeInit),
                custom_payload: null,
                forward_ton_amount:0,
                forward_payload: emptySlice()
        };
        send(SendParameters{
            to: walletBNKAddress,
            value: 0,
            mode: (SendRemainingValue  + SendIgnoreErrors  ),
            bounce: true, // 0x7362d09c - notify new owner
            body: sendBNKmsg.toCell()
        });
        
        // TODO 
        // Submit the Log Event 
        // emit(TransferEvent{sender_address: stake.from, jetton_amount: stake.amount, score: score}.toCell());
    }

     receive("Claim") {

        let ctx: Context = context();
        let stakingAddress:Address = contractAddress(initOf StakeStorage(ctx.sender,myAddress()));
        let msg: GetWeighted= GetWeighted{
            applied_user_address: ctx.sender
            };
        send(SendParameters{
            to: stakingAddress,
            value: 0,
            mode: (SendRemainingValue /* + SendIgnoreErrors */),
            bounce: true,
            body:msg.toCell()
        } );
    }
    // answer for Claim
    receive(_msg: Mint) {
        // dump("mint");
        let ctx: Context = context();
        let stakingAddress:Address = contractAddress(initOf StakeStorage(_msg.to ,myAddress()));
        // dump(_msg.to);
        // dump(self.BNKjetton);
        require(ctx.sender == stakingAddress,  "Not allowed sender");

        let mint: Mint = Mint{
                to: _msg.to,
                amount: _msg.amount
        };

        send(SendParameters{
            to: self.ARCjetton,
            value: 0,
            mode: (SendRemainingValue /* + SendIgnoreErrors */),
            bounce: true,
            body:mint.toCell()
        }
        );
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, myAddress());
    }

    // fun _calculate_stake_wallet_init(owner_address: Address): StateInit {
    //     return initOf StakeStorage (owner_address, myAddress());
    // }

    get fun calculate_stake_address(owner_address: Address): Address {
        return contractAddress(initOf StakeStorage (owner_address, myAddress()));
    } 


}