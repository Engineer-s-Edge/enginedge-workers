declare module 'googleapis' {
  export const google: {
    auth: {
      OAuth2Client: new (
        clientId: string,
        clientSecret: string,
        redirectUri: string,
      ) => any;
      OAuth2: new (
        clientId: string,
        clientSecret: string,
        redirectUri: string,
      ) => {
        generateAuthUrl: (options: any) => string;
        getToken: (code: string) => Promise<{ tokens: any }>;
        setCredentials: (tokens: any) => void;
      };
    };
    oauth2: (options: { version: string; auth: any }) => {
      userinfo: {
        get: (params?: any) => Promise<{ data: any }>;
      };
    };
  };
}
