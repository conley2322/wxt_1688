import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const RELEASE_ID = 'omlkcfhmicbbekplnfclgnpldachonoo';

function keyId(publicKey) {
  return createHash('sha256').update(publicKey).digest().subarray(0, 16);
}

function assertReleaseId(id, source) {
  const actual = id.toString('hex').replace(/./g, (digit) => 'abcdefghijklmnop'[parseInt(digit, 16)]);
  if (actual !== RELEASE_ID) {
    throw new Error(`${source} 的扩展 ID 为 ${actual}，预期为 ${RELEASE_ID}。禁止打包。`);
  }
}

async function readSigningKey(root) {
  const path = process.env.ALOCS_CRX_KEY || join(root, '..', '.keys', 'alocs-crx.pem');
  let privateKey;
  try {
    privateKey = createPrivateKey(await readFile(path));
  } catch {
    throw new Error('无法加载发布私钥。请通过 ALOCS_CRX_KEY 指定原签名私钥，或放到 .keys/alocs-crx.pem。禁止打包。');
  }
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('CRX 发布私钥必须是原始 RSA 私钥。禁止打包。');
  }
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const id = keyId(publicKey);
  assertReleaseId(id, 'CRX 签名私钥');
  return { privateKey, publicKey, id };
}

function varint(value) {
  const bytes = [];
  while (value >= 128) {
    bytes.push((value % 128) | 128);
    value = Math.floor(value / 128);
  }
  bytes.push(value);
  return Buffer.from(bytes);
}

function protobufField(field, data) {
  return Buffer.concat([varint((field << 3) | 2), varint(data.length), data]);
}

export function chromiumReleaseHooks() {
  let signingKey;
  return {
    async 'zip:extension:start'(wxt) {
      if (wxt.config.browser !== 'chrome') return;
      const manifest = JSON.parse(await readFile(join(wxt.config.outDir, 'manifest.json'), 'utf8'));
      if (!manifest.key) throw new Error('ZIP 的 manifest.json 缺少固定公钥 key。禁止打包。');
      assertReleaseId(keyId(Buffer.from(manifest.key, 'base64')), 'ZIP 公钥');
      signingKey = await readSigningKey(wxt.config.root);
    },
    async 'zip:extension:done'(wxt, archivePath) {
      if (wxt.config.browser !== 'chrome') return;
      const { privateKey, publicKey, id } = signingKey;
      const archive = await readFile(archivePath);
      // CRX3 signs the SignedData protobuf and the exact same ZIP bytes.
      const signedData = protobufField(1, id);
      const size = Buffer.alloc(4);
      size.writeUInt32LE(signedData.length);
      const payload = Buffer.concat([Buffer.from('CRX3 SignedData\0'), size, signedData, archive]);
      const signature = sign('sha256', payload, privateKey);
      const proof = Buffer.concat([protobufField(1, publicKey), protobufField(2, signature)]);
      const header = Buffer.concat([protobufField(2, proof), protobufField(10000, signedData)]);
      const preamble = Buffer.alloc(12);
      preamble.write('Cr24');
      preamble.writeUInt32LE(3, 4);
      preamble.writeUInt32LE(header.length, 8);
      await writeFile(archivePath.replace(/\.zip$/, '.crx'), Buffer.concat([preamble, header, archive]));
    },
  };
}
