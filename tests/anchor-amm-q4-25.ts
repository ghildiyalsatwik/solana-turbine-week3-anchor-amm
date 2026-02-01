import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction,
  createMint, getAssociatedTokenAddressSync, mintTo, TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("anchor-amm-q4-25", () => {
  // Configure the client to use the local cluster.

  const provider = anchor.AnchorProvider.env();
  
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;

  const initializer = provider.wallet.publicKey;

  const seed = new anchor.BN(1234);

  const depositor = anchor.web3.Keypair.generate();

  let mintX: anchor.web3.PublicKey;

  let mintY: anchor.web3.PublicKey;

  let depositorATAX: anchor.web3.PublicKey;

  let depositorATAY: anchor.web3.PublicKey;

  let vaultX: anchor.web3.PublicKey;

  let vaultY: anchor.web3.PublicKey;

  let mintLP: anchor.web3.PublicKey;

  let mintLPBump: number;

  let configPDA: anchor.web3.PublicKey;

  let configBump: number;

  const depositAmount = 100;

  let depositorMintLPATA: anchor.web3.PublicKey;

  before(async () => {

    await provider.connection.requestAirdrop(initializer, 10 * anchor.web3.LAMPORTS_PER_SOL);

    await provider.connection.requestAirdrop(depositor.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    await new Promise(resolve => setTimeout(resolve, 1000));

    [configPDA, configBump] = anchor.web3.PublicKey.findProgramAddressSync(

      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],

      program.programId
    
    );

    console.log(`Address of config account is: ${configPDA.toBase58()}`);

    [mintLP, mintLPBump] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("lp"), configPDA.toBuffer()], program.programId);

    console.log(`Address of the LP mint is: ${mintLP.toBase58()}`);

    depositorMintLPATA = getAssociatedTokenAddressSync(mintLP, depositor.publicKey, true);

    mintX = await createMint(provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6);

    mintY = await createMint(provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6);

    vaultX = getAssociatedTokenAddressSync(mintX, configPDA, true);

    vaultY = getAssociatedTokenAddressSync(mintY, configPDA, true);

    depositorATAX = getAssociatedTokenAddressSync(mintX, depositor.publicKey);

    const depositorATAXTx = new anchor.web3.Transaction().add(

      createAssociatedTokenAccountInstruction(provider.wallet.publicKey, depositorATAX, depositor.publicKey, mintX)
    
    );

    await provider.sendAndConfirm(depositorATAXTx);

    await mintTo(provider.connection, provider.wallet.payer, mintX, depositorATAX, provider.wallet.payer, BigInt(depositAmount) * BigInt(10 ** 6));

    depositorATAY = getAssociatedTokenAddressSync(mintY, depositor.publicKey);

    const depositorATAYTx = new anchor.web3.Transaction().add(

      createAssociatedTokenAccountInstruction(provider.wallet.publicKey, depositorATAY, depositor.publicKey, mintY)
    
    );

    await provider.sendAndConfirm(depositorATAYTx);

    await mintTo(provider.connection, provider.wallet.payer, mintY, depositorATAY, provider.wallet.payer, BigInt(depositAmount) * BigInt(10 ** 6));


  });

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize(seed, 10000, initializer).accountsStrict({

      initializer: initializer,
      mintX: mintX,
      mintY: mintY,
      mintLp: mintLP,
      vaultX: vaultX,
      vaultY: vaultY,
      config: configPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId

    }).rpc();
    
    console.log("Your transaction signature", tx);

    const configAccount = await program.account.config.fetch(configPDA);

    expect(configAccount.authority.toBase58()).to.equal(initializer.toBase58());

    expect(configAccount.seed.toNumber()).to.equal(seed.toNumber());

    expect(configAccount.fee).to.equal(10000);

    expect(configAccount.mintX.toBase58()).to.equal(mintX.toBase58());

    expect(configAccount.mintY.toBase58()).to.equal(mintY.toBase58());
  
  });

  
  it("Liquidity deposited!", async () => {

    const tx = await program.methods.deposit(new anchor.BN(10 * (10 ** 6)), new anchor.BN(100 * (10 ** 6)), new anchor.BN(100 * (10 ** 6))).accountsStrict({

      user: depositor.publicKey,
      mintX: mintX,
      mintY: mintY,
      config: configPDA,
      mintLp: mintLP,
      vaultX: vaultX,
      vaultY: vaultY,
      userX: depositorATAX,
      userY: depositorATAY,
      userLp: depositorMintLPATA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId

    }).signers([depositor]).rpc();

    console.log("Your transaction signature", tx);

    const depositorMintLPATAAccount = await getAccount(provider.connection, depositorMintLPATA);

    expect(depositorMintLPATAAccount.amount).to.equal(BigInt(10) * BigInt(10 ** 6));

  });

});