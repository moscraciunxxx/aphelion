import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Status { EMPTY = 0, OPEN = 1, CONFIRMED = 2 }

export type Witnesses<PS> = {
  observerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  skyHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  strainHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  snrMilli(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  instrumentSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  issueInstrument(context: __compactRuntime.CircuitContext<PS>,
                  instClass_0: bigint,
                  minSnrBand_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fileDetection(context: __compactRuntime.CircuitContext<PS>,
                instClass_0: bigint,
                minSnrBand_0: bigint,
                epochIn_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmDetection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  issueInstrument(context: __compactRuntime.CircuitContext<PS>,
                  instClass_0: bigint,
                  minSnrBand_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fileDetection(context: __compactRuntime.CircuitContext<PS>,
                instClass_0: bigint,
                minSnrBand_0: bigint,
                epochIn_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmDetection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  makeAttestation(instClass_0: bigint,
                  minSnrBand_0: bigint,
                  secret_0: Uint8Array): Uint8Array;
  makeNullifier(sk_0: Uint8Array, epochBytes_0: Uint8Array): Uint8Array;
  bindObservation(sky_0: Uint8Array, strain_0: Uint8Array): Uint8Array;
  minSnrForBand(band_0: bigint): bigint;
}

export type Circuits<PS> = {
  makeAttestation(context: __compactRuntime.CircuitContext<PS>,
                  instClass_0: bigint,
                  minSnrBand_0: bigint,
                  secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  makeNullifier(context: __compactRuntime.CircuitContext<PS>,
                sk_0: Uint8Array,
                epochBytes_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  bindObservation(context: __compactRuntime.CircuitContext<PS>,
                  sky_0: Uint8Array,
                  strain_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  minSnrForBand(context: __compactRuntime.CircuitContext<PS>, band_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  issueInstrument(context: __compactRuntime.CircuitContext<PS>,
                  instClass_0: bigint,
                  minSnrBand_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fileDetection(context: __compactRuntime.CircuitContext<PS>,
                instClass_0: bigint,
                minSnrBand_0: bigint,
                epochIn_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmDetection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly status: Status;
  readonly detectionCount: bigint;
  readonly instrumentClass: bigint;
  readonly snrBand: bigint;
  readonly epoch: bigint;
  readonly nullifier: Uint8Array;
  readonly attestationRoot: Uint8Array;
  readonly contractTag: Uint8Array;
  spent: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
