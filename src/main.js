#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { assemble, disAssemble, run } from "./code.js";
import { generateAssembly } from "./c.js";

const program = new Command();

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));

program.name('tinyvm').version(pkg.version);

const resolve = (name) => path.resolve(process.cwd(), name);

function readFile(name, encoding) {
    try {
        return fs.readFileSync(resolve(name), encoding);
    } catch (e) {
        console.error('Failed to open file:', resolve(name));
        process.exit(1);
    }
}
function guarded(fn) {
    try {
        fn();
    } catch (e) {
        if (e.constructor.name === 'AsmError' || e.constructor.name === 'RuntimeError') {
            console.error(e.message);
            process.exit(1);
        }
        throw e;
    }
}

program
    .command('assemble <filename>')
    .description('assembles an assembly file to a TinyVM binary')
    .option('-o, --out <filename.tv>', 'output file name')
    .action((filename, options) => guarded(() => {
        const binary = assemble(readFile(filename, 'utf8'), resolve(filename));
        const out = options.out ?? path.basename(filename, path.extname(filename)) + '.tv';

        fs.writeFileSync(resolve(out), binary);

        console.log(`Wrote ${binary.length} bytes to ${out}`);
    }));

program
    .command('compile <filename>')
    .description('compiles a c program into a TinyVM binary')
    .option('-a, --asm', 'output TinyVM assembly instead of a binary')
    .option('-o, --out <filename.tv>', 'output file name')
    .action((filename, options) => guarded(() => {
        const assembly = generateAssembly(readFile(filename, 'utf8'));
        var output = options.asm ? assembly : assemble(assembly, resolve(filename));

        const out = options.out ?? path.basename(filename, path.extname(filename)) + '.tv';
        fs.writeFileSync(resolve(out), output);

        console.log(`Wrote ${output.length} bytes to ${out}`);
    }));
    
const EXAMPLES_DIR = path.join(PKG_ROOT, 'examples');

function listExamples() {
    const out = [];
    for (const dir of fs.readdirSync(EXAMPLES_DIR)) {
        const full = path.join(EXAMPLES_DIR, dir);
        if (!fs.statSync(full).isDirectory()) continue;
        for (const f of fs.readdirSync(full)) {
            const ext = path.extname(f);
            if (!['.s', '.c'].includes(ext) || !fs.statSync(path.join(full, f)).isFile()) continue;
            out.push({ name: `${dir}/${path.basename(f, ext)}`, file: path.join(full, f), c: ext === '.c' });
        }
    }
    return out;
}

program
    .command('examples')
    .description('lists the bundled example programs')
    .action(() => listExamples().forEach(e => console.log(e.name)));

program
    .command('example <name>')
    .description('runs a bundled example, e.g. asm/fibonacci')
    .action((name) => guarded(() => {
        const ex = listExamples().find(e => e.name === name);
        if (!ex) {
            console.error(`No example "${name}". Try: tinyvm examples`);
            process.exit(1);
        }
        const src = fs.readFileSync(ex.file, 'utf8');
        run(assemble(ex.c ? generateAssembly(src) : src, ex.file));
    }));

program
    .command('run <filename>')
    .description('runs a TinyVM binary')
    .action((filename) => guarded(() => run(readFile(filename))));

program
    .command('exec <filename>')
    .description('assembles and runs a TinyVM assembly file')
    .action((filename) => guarded(() => run(assemble(readFile(filename, 'utf8'), resolve(filename)))));

program
    .command('exec-c <filename>')
    .description('compiles, assembles and runs a c file')
    .action((filename) => guarded(() => run(assemble(generateAssembly(readFile(filename, 'utf8')), resolve(filename)))));

program
    .command('dis <filename>')
    .description('disassembles a TinyVM binary')
    .option('-n, --no-addr', 'dosent\'t output addresses')
    .action((filename, options) => {
        guarded(() => console.log(disAssemble(readFile(filename), options.addr)))
    });

program.parse();