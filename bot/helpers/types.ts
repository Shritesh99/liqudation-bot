export type eNetwork = eXrpNetwork;

export enum eXrpNetwork {
	main = "xrplevm",
	testnet = "xrplevm-testnet",
}

export type iParamsPerNetwork<T> = {
	[k in eNetwork]?: T;
};
