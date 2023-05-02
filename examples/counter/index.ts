export class Counter {
    constructor(public count = 0) {}

    add() {
        this.count += 1;
    }

    subtract() {
        this.count -= 1;
    }
}

export const counter = new Counter();
