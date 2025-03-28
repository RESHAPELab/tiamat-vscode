import * as vscode from 'vscode';
import {post} from 'axios';
import * as fs from 'fs';
import {authenticateWithGitHub} from './auth';
import {syncPersonalization, updatePersonalization} from './personalization';
import apiUrl from "./config";

const MAX_HISTORY_LENGTH = 6;
const GOOD = 1;
const BAD = 0;
const GOOD_REASONS: string[] = ["Helpful", "Accurate", "Well Explained"];
const BAD_REASONS: string[] = ["Incorrect", "Not Helpful", "Confusing"];
const FEEDBACK_BUTTON_TEXT = "💬 Provide Feedback to Tiamat";

export function activate(context: vscode.ExtensionContext) {
	// Logic for collecting and sending feedback to the server
    vscode.commands.registerCommand('tiamat.handleFeedback', async (args) => {
        try {
            console.log('Arguments:', args);

            const rating = await vscode.window.showQuickPick(['Good', 'Bad'], {
                placeHolder: 'How was the response?'
            });

            if (!rating) {
                return;
            }

            const ratingEnum = rating === 'Good' ? GOOD : BAD;

            const reasons = ratingEnum === GOOD ? [...GOOD_REASONS, "Other"] : [...BAD_REASONS, "Other"];

            const selectedReason = await vscode.window.showQuickPick(reasons, {
                placeHolder: `Why was this response ${rating}?`
            });

            let customReason = selectedReason;
            if (selectedReason === "Other") {
                customReason = await vscode.window.showInputBox({
                    placeHolder: "Please provide additional details"
                });
            }

            if (!customReason) {
                return;
            }

            const apiResponse = await post(`${apiUrl}/api/feedback`, {rating: ratingEnum, reason: customReason, ...args});
            console.log('API Response:', apiResponse.data);
            vscode.window.showInformationMessage('Thank you for your feedback!');
        } catch (error) {
            console.error('Error posting feedback:', error);
            vscode.window.showErrorMessage('An error occurred while posting feedback. Please try again later.');
        }
    });

    // Handles responses to chat prompts
	const chatHandler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        stream.progress("Thinking...");
        console.log("User message:", request.prompt);
        console.log("Token:", token);
        console.log("References:", request.references);
        console.log("Context:", chatContext);

        let code = "";

        console.log("\nRelevant references: ");
        
        request.references.forEach((ref) => {
            if (ref.value instanceof vscode.Location) {
                console.log(ref, "is a Location");
                console.log(ref.id, "-", ref.value);

                const uri = ref.value.uri;
                const range = ref.value.range;

                const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === uri.fsPath);

                if (document) {
                    const fileName = uri.path.split("/").pop();
                    code += (ref.modelDescription || "File provided for context") + " (" + fileName + ")" + ":\n" + document?.getText(range);
                }
            } else if (ref.value instanceof vscode.Uri) {
                console.log(ref, "is a URI");
                console.log(ref.id, "-", ref.value);

                const uri = ref.value;

                const fileContent = fs.readFileSync(uri.fsPath, 'utf8');

                console.log("File content:", fileContent);

                const fileName = uri.path.split("/").pop();
                code += "\n" + (ref.modelDescription || "File provided for context") + " (" + fileName + ")" + ":\n" + fileContent + "\n";
            }
        });
        console.log("Final code:");
        console.log(code);

        let history: string[] = [];

        chatContext.history.slice(-MAX_HISTORY_LENGTH).forEach((item) => {
            if (item instanceof vscode.ChatRequestTurn) {
                history.push("User: " + item.prompt);
            } else if (item instanceof vscode.ChatResponseTurn) {
                let fullMessage = '';
                item.response.forEach(r => {
                    const mdPart = r as vscode.ChatResponseMarkdownPart;
                    fullMessage += mdPart.value.value;
                });

                history.push("Tiamat: " + fullMessage);
            }
        });

        console.log("Chat history:", history);

        let id = "0";
        try {
            id = await authenticateWithGitHub(context) ?? "0";
        } catch (error) {
            console.error('Error connecting:', error);
            
        }
        console.log("User ID:", id);

        try {
            const apiResponse = await post(`${apiUrl}/api/prompt`, {id, code, message: request.prompt, history});
            stream.markdown(apiResponse.data.response);
            var args = {id: id, code: code, message: request.prompt, response: apiResponse.data.response};          
            stream.button({
                command: 'tiamat.handleFeedback',
                title: vscode.l10n.t(FEEDBACK_BUTTON_TEXT),
                arguments: [args]
            });
        } catch (err) {
            console.log(err);
            stream.markdown("I'm sorry, I'm having trouble connecting to the server. Please try again later.");
        }

		return;
	};

	// create participant
	const tutor = vscode.chat.createChatParticipant("tiamat.Tiamat", chatHandler);

	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');

    // Personalization management

    // Sync personalization with backend
    syncPersonalization(context);

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (
            e.affectsConfiguration('personalization.prompt')
        ) {
            const config = vscode.workspace.getConfiguration();
            const newPrompt = config.get<string>('personalization.prompt');

            if (newPrompt) {
                updatePersonalization(context, newPrompt);
            }
        }
    });
    
    // Allow user to manage personalization
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openPersonalization', () => {
            vscode.window.showInformationMessage('Opening Tiamat Personalization settings...');
        })
    );
      
    const personalizationStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    personalizationStatusBarItem.text = '$(gear) Tiamat Personalization';
    personalizationStatusBarItem.tooltip = 'View or modify your personalization settings for Tiamat';
    personalizationStatusBarItem.command = 'extension.openPersonalization';
    personalizationStatusBarItem.show();

    context.subscriptions.push(personalizationStatusBarItem);
}

export function deactivate() { }
