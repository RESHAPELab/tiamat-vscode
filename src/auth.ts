import * as vscode from 'vscode';

interface GitHubUser {
    login: string;
    id: number;
}

async function verifyGithubToken(accessToken: string): Promise<boolean> {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${accessToken}`
            }
        });

        if (!response.ok) {
            console.error(`Token verification failed: ${response.statusText}`);
            return false;
        }

        // Type assertion to tell TypeScript what the response shape is
        const data = (await response.json()) as GitHubUser;

        console.log(`Authenticated GitHub User: ${data.login} (ID: ${data.id})`);
        return true;
    } catch (error) {
        console.error(`Error verifying token: ${error}`);
        return false;
    }
}

export async function authenticateWithGitHub(context: vscode.ExtensionContext) {
    let cachedId = context.globalState.get<string>("tiamatUserId");
    let cachedToken = context.globalState.get<string>("tiamatAccessToken");

    if (cachedId && cachedToken) {
        const isValid = await verifyGithubToken(cachedToken);
        if (isValid) {
            return cachedId;
        } else {
            console.warn("Cached token is invalid. Re-authenticating...");
        }
    }

    try {
        const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: true });
        if (session) {
            vscode.window.showInformationMessage(`Authenticated as ${session.account.label}`);
            await context.globalState.update("tiamatUserId", session.account.id);
            await context.globalState.update("tiamatAccessToken", session.accessToken);
            return session.account.id;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Authentication failed.`);
        console.error(error);
    }
}
