import {log, BigInt, Address, store} from "@graphprotocol/graph-ts/index";

import {
    Transfer,
    ReceivedChild,
    DigitalaxGarmentNFT as DigitalaxGarmentNFTContract
} from "../generated/DigitalaxGarmentNFT/DigitalaxGarmentNFT";

import {
    DigitalaxMaterials as DigitalaxMaterialsContract
} from "../generated/DigitalaxMaterials/DigitalaxMaterials";

import {
    DigitalaxGarment,
    DigitalaxMaterialOwner,
    DigitalaxCollector
} from "../generated/schema";

export const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000');

export function handleTransfer(event: Transfer): void {
    log.info("Handle Garment Transfer @ Hash {}", [event.transaction.hash.toHexString()]);
    let contract = DigitalaxGarmentNFTContract.bind(event.address);

    // This is the birthing of a garment
    if (event.params.from.equals(ZERO_ADDRESS)) {
        let garment = new DigitalaxGarment(event.params.tokenId.toString());
        garment.designer = contract.garmentDesigners(event.params.tokenId);
        garment.primarySalePrice = contract.primarySalePrice(event.params.tokenId);
        garment.tokenUri = contract.tokenURI(event.params.tokenId);
        garment.strands = new Array<string>();
        garment.save();

        let collector = DigitalaxCollector.load(event.params.to.toHexString());

        let garmentsOwned = new Array<string>();
        let strandsOwned = new Array<string>();
        if (collector == null) {
            collector = new DigitalaxCollector(event.params.to.toHexString());
        } else {
            garmentsOwned = collector.garmentsOwned;
            strandsOwned = collector.strandsOwned;
        }

        garmentsOwned.push(event.params.tokenId.toString())
        collector.garmentsOwned = garmentsOwned;
        collector.strandsOwned = strandsOwned;
        collector.save();
    }

    // todo handle burn
    else if (event.params.to.equals(ZERO_ADDRESS)) {
        let garment = DigitalaxGarment.load(event.params.tokenId.toString());
        let collector = DigitalaxCollector.load(event.params.from.toHexString());
        collector.strandsOwned = garment.strands;
        collector.save();

        store.remove('DigitalaxGarment', event.params.tokenId.toString());
    }
}

export function handleChildReceived(event: ReceivedChild): void {
    log.info("Handle Child ID {} linking to Garment ID {} @ Hash {}", [
        event.params.childTokenId.toString(),
        event.transaction.hash.toHexString(),
        event.params.toTokenId.toString()
    ]);

    let contract = DigitalaxGarmentNFTContract.bind(event.address);

    let garment = DigitalaxGarment.load(event.params.toTokenId.toString());

    let childId = event.params.toTokenId.toString() + '-' + event.params.childTokenId.toString();
    let child = DigitalaxMaterialOwner.load(childId);

    if (child == null) {
        child = new DigitalaxMaterialOwner(childId);
        child.amount = event.params.amount;
    } else {
        child.amount = child.amount + event.params.amount;
    }

    child.contract = contract.childContract();

    const childContract = DigitalaxMaterialsContract.bind(contract.childContract());
    child.tokenUri = childContract.uri(event.params.childTokenId);
    child.save();

    let strands = garment.strands;

    strands.push(childId);
    garment.strands = strands;

    garment.save();
}
