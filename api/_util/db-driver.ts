import { Client, QueryConfig } from "pg";

export function query<T = unknown>(SQL: QueryConfig<T[]>): Promise<T[]> {
  return new Promise(async function(resolve, reject) {
    /**
     * @note reliant on ENV for connection variables
     * @see https://www.postgresql.org/docs/10/libpq-envars.html */
    const client = new Client();

    try {
      await client.connect();
    } catch (connectionError) {
      console.error(connectionError);
      return reject("Failed to connect to DB");
    }
    let rows: T[] = [];
    try {
      const result = await client.query(SQL);
      if (result && result.rowCount) rows = result.rows;
    } catch (queryError) {
      return reject(queryError);
    }
    resolve(rows);
  });
}
