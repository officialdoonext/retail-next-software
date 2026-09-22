import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "public_NeXgvX195/XyDVlmynBe7kS0eUs=",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_TeYodf7QIX/JOMivpd5ASQp6Rrs=",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/doonext",
});

export default imagekit;
