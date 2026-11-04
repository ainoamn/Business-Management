import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <script src="https://id.bhd-om.com/bhd-identity.js" defer />
        <link rel="preconnect" href="https://id.bhd-om.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
