import * as vscode from 'vscode';

export async function authenticateWithGitHub(context: vscode.ExtensionContext) {
    let cachedId = context.globalState.get<string>("tiamatUserId");

    if (cachedId) {
        return cachedId;
    }

    try {
        const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: true });
        if (session) {
            vscode.window.showInformationMessage(`Authenticated as ${session.account.label}`);
            context.globalState.update("tiamatUserId", session.account.id);
            return session.account.id;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Authentication failed.`);
        console.error(error);
    }
}