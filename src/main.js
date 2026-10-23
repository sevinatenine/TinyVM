import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

import { assemble, disAssemble, run } from "./code.js";
import { generateAssembly } from "./c.js";

const program = new Command();

program
    .name('tinyvm')
    .version('1.0.0');

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