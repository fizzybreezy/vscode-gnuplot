import * as vscode from 'vscode';
import {Extension} from './extension'

export class Watcher implements vscode.Disposable { 
    private _extension: Extension;
    private _watchedFiles: { [file: string]: { lastChange: number; preview: string } } ={};
    private _disposables: vscode.Disposable[] = [];

    private  _config: vscode.WorkspaceConfiguration | undefined;
    private _changeDelay: number = 1000;
    private _changeTimeout: number = 5000;

    public dispose() {
        this._watchedFiles = {};
        while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
        }
    }

    public readConfig() {
        this._config = vscode.workspace.getConfiguration('gnuplot.watcher');
        this._changeDelay = this._config.get('delay') as number;
        this._changeTimeout = this._config.get('timeout') as number;
    }

    private _updatePreview(document: vscode.TextDocument | undefined) {
        if(!document) { return }
        if( document.languageId != 'gnuplot')  { return }
        
        document.save();
        let preview = this._extension.builder.buildFig(document);
        if (preview != '' ) { this._watchedFiles[document.uri.fsPath].preview = preview; }
        this._extension.viewer.update(this._watchedFiles[document.uri.fsPath].preview);
    }

    public startWatching() {
        this.readConfig();
        this._extension.builder.readConfig();
        this._disposables = [
        vscode.workspace.onDidChangeTextDocument(
            (e: vscode.TextDocumentChangeEvent) => {this.onFileChange(e.document)}
        ),
        vscode.window.onDidChangeActiveTextEditor(
            (e: vscode.TextEditor | undefined ) => {this.onEditorChange(e)}
        )]
    }

    public onEditorChange(e: vscode.TextEditor | undefined ) {
        if(!e) { return }

        this._watch(e.document);
        this._updatePreview(e.document);
    }

    public onFileChange(document: vscode.TextDocument, waitedDelay?: boolean) {
        this._watch(document);
        
        if (+new Date() - this._watchedFiles[document.uri.fsPath].lastChange < this._changeDelay) {
            if (!waitedDelay) {
                this._watchedFiles[document.uri.fsPath].lastChange = +new Date();
                setTimeout( () => { this.onFileChange(document, true)}, this._changeDelay)
            }
            return
        }
        
        this._watchedFiles[document.uri.fsPath].lastChange = +new Date();

        if (+new Date() - this._watchedFiles[document.uri.fsPath].lastChange > this._changeTimeout) {
            return
        }

        this._updatePreview(document);
    }

    private _watch(document: vscode.TextDocument) {
        if( document.languageId != 'gnuplot')  { return }

        if (!(document.uri.fsPath in this._watchedFiles)) {
            this._watchedFiles[document.uri.fsPath] = { lastChange: +new Date(), preview:'' };
        }
    }

    public constructor(extension: Extension) {
        this._extension = extension;
        this.readConfig();
    }
}