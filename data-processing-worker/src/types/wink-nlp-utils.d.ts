declare module 'wink-nlp-utils' {
  const nlpUtils: {
    string: {
      tokenize0: (text: string) => string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  export default nlpUtils;
}
