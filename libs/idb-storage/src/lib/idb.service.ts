import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/**
 * Generic IndexedDB storage service for persisting data across browser sessions.
 * Provides a simple interface for CRUD operations on any entity type.
 */
@Injectable({ providedIn: 'root' })
export class IdbService {
  private dbByName = new Map<string, IDBDatabase>();
  private initPromises = new Map<string, Promise<void>>();
  private storeToDbName = new Map<string, string>();

  /**
   * Initialize IndexedDB with a specific database name and object stores.
   * Call this method once during app initialization.
   * 
   * @param dbName - Name of the IndexedDB database
   * @param stores - Array of object store configurations
   */
  initialize(
    dbName: string,
    stores: Array<{
      name: string;
      keyPath?: string;
      autoIncrement?: boolean;
    }>
  ): Promise<void> {
    this.registerStoreOwnership(dbName, stores);

    if (this.dbByName.has(dbName)) {
      return Promise.resolve();
    }

    const existingPromise = this.initPromises.get(dbName);
    if (existingPromise) {
      return existingPromise;
    }

    const initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, {
              keyPath: store.keyPath || 'id',
              autoIncrement: store.autoIncrement ?? false,
            });
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbByName.delete(dbName);
        };
        this.dbByName.set(dbName, db);
        resolve();
      };
    });

    this.initPromises.set(dbName, initPromise);
    return initPromise;
  }

  /**
   * Get a single item by key from a store.
   */
  get<T>(storeName: string, key: IDBValidKey): Observable<T> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          if (result === undefined) {
            reject(new Error(`Item with key ${key} not found in ${storeName}`));
          } else {
            resolve(result as T);
          }
        };
      });
    });
  }

  /**
   * Get all items from a store.
   */
  getAll<T>(storeName: string): Observable<T[]> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as T[]);
      });
    });
  }

  /**
   * Add a new item to a store.
   */
  add<T extends object>(storeName: string, item: T): Observable<IDBValidKey> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(item);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });
  }

  /**
   * Add or update an item in a store.
   */
  put<T extends object>(storeName: string, item: T): Observable<IDBValidKey> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });
  }

  /**
   * Delete an item from a store by key.
   */
  delete(storeName: string, key: IDBValidKey): Observable<void> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  /**
   * Clear all items from a store.
   */
  clear(storeName: string): Observable<void> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  /**
   * Count items in a store.
   */
  count(storeName: string): Observable<number> {
    return this.withStoreDb(storeName, (db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });
  }

  /**
   * Query items using a filter function.
   */
  query<T>(
    storeName: string,
    filter: (item: T) => boolean
  ): Observable<T[]> {
    return this.getAll<T>(storeName).pipe(
      map((items) => items.filter(filter))
    );
  }

  closeAll(): void {
    for (const db of this.dbByName.values()) {
      db.close();
    }
    this.dbByName.clear();
    this.initPromises.clear();
  }

  async deleteDatabases(dbNames: string[]): Promise<void> {
    this.closeAll();

    for (const dbName of dbNames) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Failed to delete database '${dbName}'.`));
        request.onblocked = () => reject(new Error(`Deletion of database '${dbName}' was blocked.`));
      });
    }
  }

  /**
   * Helper method to ensure DB is initialized before operations.
   */
  private withStoreDb<T>(
    storeName: string,
    operation: (db: IDBDatabase) => Promise<T>
  ): Observable<T> {
    const dbName = this.storeToDbName.get(storeName);
    if (!dbName) {
      return throwError(
        () =>
          new Error(
            `Store '${storeName}' is not registered. Call initialize() with this store first.`
          )
      );
    }

    const dbPromise = this.resolveDb(dbName);
    return from(dbPromise.then((db) => operation(db))).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private registerStoreOwnership(
    dbName: string,
    stores: Array<{ name: string }>
  ): void {
    for (const store of stores) {
      const existingOwner = this.storeToDbName.get(store.name);
      if (existingOwner && existingOwner !== dbName) {
        throw new Error(
          `Store '${store.name}' is already registered to database '${existingOwner}'.`
        );
      }
      this.storeToDbName.set(store.name, dbName);
    }
  }

  private resolveDb(dbName: string): Promise<IDBDatabase> {
    const existingDb = this.dbByName.get(dbName);
    if (existingDb) {
      return Promise.resolve(existingDb);
    }

    const initPromise = this.initPromises.get(dbName);
    if (!initPromise) {
      return Promise.reject(
        new Error(`Database '${dbName}' is not initialized.`)
      );
    }

    return initPromise.then(() => {
      const db = this.dbByName.get(dbName);
      if (!db) {
        throw new Error(`Database '${dbName}' could not be resolved after initialization.`);
      }
      return db;
    });
  }
}
