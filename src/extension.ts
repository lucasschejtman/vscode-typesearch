'use strict';

import * as request from 'request-promise';
import * as vscode from 'vscode';

enum Ord {
    GT = 1,
    LT = -1,
    EQ = 0
};

interface QuickItem {
    description: string;
    label: string;
    detail: string;
};

interface RawTypeDefinition {
	t: string;
	g: string[];
	m: string[];
	p: string;
	l: string;
	d: number;
};

interface CmdSelected {
    name: string;
    type: string;
}

let cache: vscode.Memento;
const cacheKey = 'typesearch.types';
const placeHolder = 'Search for Types Packages';
const typesURL = 'https://typespublisher.blob.core.windows.net/typespublisher/data/search-index-min.json';

async function onCommandSelected(cmd: CmdSelected): Promise<string> {
    if(!cmd) return;

    switch(cmd.name) {
        case 'NPM':
            return vscode.window.showInformationMessage(`npm install @types/${cmd.type} --save-dev`);
        case 'Yarn':
            return vscode.window.showInformationMessage(`yarn add @types/${cmd.type} --dev`);
        default:
            return 'No command was selected';
    }
}

async function onTypeSelected(selected: QuickItem): Promise<CmdSelected> {
    if(!selected) return;

    const selection = await vscode.window.showInformationMessage(
        `Type ${selected.label} was selected. Select an installation command for your preferred package manager`,
        ...['NPM','Yarn']
    );
    const cmd: CmdSelected = {
        name: selection,
        type: selected.label
    };

    return cmd;
}

async function fetchTypes(from: string): Promise<RawTypeDefinition[]> {
    const types = cache.get(cacheKey) as RawTypeDefinition[];
    if(types) return types;

    try {
        const response = await request({ url: from, gzip: true });
        const fetchedTypes = JSON.parse(response) as RawTypeDefinition[];
        await cache.update(cacheKey, fetchedTypes);
        return fetchedTypes;
    } catch (error) {
        return Promise.reject('Could not fetch types. Make sure you are connected to the internet');
    }
}

function typeToQuickItem(types: RawTypeDefinition[]): QuickItem[] {
    const fromRawType = (type: RawTypeDefinition): QuickItem => ({ description: type.l, label: type.t, detail: type.p });
    const sortQuickItems = (a: QuickItem, b: QuickItem): Ord => a.label < b.label ? Ord.LT : a.label > b.label ? Ord.GT : Ord.EQ;
    return types.map(fromRawType).sort(sortQuickItems);
}

async function onCommandActivation(): Promise<void> {
    try {
        const types = await fetchTypes(typesURL);
        const selected = await vscode.window.showQuickPick(typeToQuickItem(types), { placeHolder });
        const copyCmd = await onTypeSelected(selected);
        await onCommandSelected(copyCmd);
    } catch (error) {
        return Promise.reject(error);
    }
}

export function activate(context: vscode.ExtensionContext) {
    cache = context.globalState;
    const searchTypeSearch = vscode.commands.registerCommand('extension.typesearch', onCommandActivation);
    context.subscriptions.push(searchTypeSearch);
}

export function deactivate() { }