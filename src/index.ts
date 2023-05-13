//Exports all handler functions


import { atob } from "abab";

if (!global.atob) {
    global.atob = atob as any;
}


export * from "./mappings/handleERC721";
export * from "./mappings/handleERC1155single";
