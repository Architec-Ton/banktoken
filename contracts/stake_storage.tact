import "@stdlib/deploy";
// import "./storage.tact";


struct AmountTime {
    amount: Int;
    time: Int;
}

struct PrevNextCells {
    previous: Address;
    next: Address;
}

message Add {
    queryId: Int as uint64;
    amount: Int as uint32;
    previousCell: Address;
    nextCell: Address;
}

message Sub {
    queryId: Int as uint64;
    amount: Int as uint32;
    date: Int as uint32;
}

message UpdateNext {
    nextCell: Address;
}



trait Storage /* with Ownable  with Deployable */ {
    
    amount: Int;
    updatetime: Int;
    previousCell: Address;
    nextCell: Address;
    factory: Address;

/* 
    receive(msg: Add) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        self.amount += msg.amount;
        self.updatetime = now();
        self.previousCell= msg.previousCell;
        self.nextCell = msg.nextCell;
    } 
 */
    receive(msg: Sub) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        self.amount += msg.amount;
        self.updatetime = now();
    } 

    receive (msg: UpdateNext) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        self.nextCell = msg.nextCell;
    }

    receive ("GetPrevNextCells") {
        let ctx: Context = context();
        let pn: PrevNextCells = PrevNextCells{previous: self.previousCell, next:  self.nextCell};
        send(SendParameters{
                to: ctx.sender,
                value: 0,
                mode: (SendRemainingValue + SendIgnoreErrors),
                bounce: true,
                body:pn.toCell()
            }
        );
    }

    get fun  prevnextcells(): PrevNextCells {
        return PrevNextCells{previous: self.previousCell, next:  self.nextCell};
    }

    
    get fun amountTime(): AmountTime {
        return   AmountTime{amount: self.amount, time: self.updatetime};
    }


}


contract StakeStorage with Deployable, Storage {
    amount: Int as uint32 = 0;
    updatetime: Int as uint32 = 0;
    previousCell: Address;
    nextCell: Address;
    factory: Address;
    parameter: Int as uint16 = 1;
    owner: Address;
    empty: Bool = true;


    init(owner: Address) {
        
        self.previousCell = newAddress(0,0);
        self.nextCell =  newAddress(0,0);
        self.factory = context().sender;
        self.owner = owner;
    }

    receive(msg: Add) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        require(self.empty, "Already filled");
        self.amount += msg.amount;
        self.updatetime = now();
        self.previousCell= msg.previousCell;
        self.nextCell = msg.nextCell;
        self.empty = false;
    }

    receive ("GetAmountDate") {
        let ctx: Context = context();
        let ap: AmountTime =  AmountTime{amount: self.amount, time: self.updatetime};
        send(SendParameters{
                to: ctx.sender,
                value: 0,
                mode: (SendRemainingValue + SendIgnoreErrors),
                bounce: true,
                body:ap.toCell()
            }
        );
    }

    fun score_function(jettonAmount: Int): Int {         
        return (jettonAmount * pow(10, 18) / self.durationTime() * self.parameter / 86400); 
        /* TODO  parameter
            FARM SPEED
            Количество   BNK (Банки)
            Скорость   добычи ARC/DAY
            1-9   BNK       0.001
            10-99  BNK      0.011
            100-999 BNK     0.22
            1000-9999 BNK   2.5
            10000   + BNK   30
    */
    }

    fun durationTime(): Int {
        return now() - self.updatetime;
    }


}
