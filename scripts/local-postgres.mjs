import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { Client } from "pg";

export function localPostgres({ directory, user, password, port }) {
  const embedded = new EmbeddedPostgres({ databaseDir: directory, user, password, persistent: true, createPostgresUser: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog(){}, onError(){} });
  const binary = async () => (await import("@embedded-postgres/" + (process.platform === "win32" ? "windows" : process.platform) + "-" + process.arch)).pg_ctl;
  const control = async (args, allowed = [0]) => {
    const executable = await binary();
    return new Promise((done,reject)=>{const child=spawn(executable,args,{stdio:"ignore",windowsHide:true});child.on("error",reject);child.on("exit",code=>allowed.includes(code)?done():reject(new Error("Local PostgreSQL lifecycle command failed.")));});
  };
  return {
    initialise: () => embedded.initialise(),
    start: () => control(["-D",directory,"-l",join(directory,"server.log"),"-o","-p " + port + " -c listen_addresses=127.0.0.1","-w","start"]),
    stop: () => control(["-D",directory,"-m","fast","-w","stop"], [0, 3]),
    async createDatabase(name) {
      if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid local test database name.");
      const client=new Client({host:"127.0.0.1",port,user,password,database:"postgres"});
      await client.connect();try {await client.query('CREATE DATABASE "'+name+'"');}finally{await client.end();}
    },
  };
}
