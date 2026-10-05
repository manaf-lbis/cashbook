import { Model, Document, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';

export interface IBaseRepository<T extends Document> {
  create(item: Partial<T>): Promise<T>;
  findById(id: string, populate?: any): Promise<T | null>;
  findOne(filter: FilterQuery<T>, populate?: any): Promise<T | null>;
  find(filter?: FilterQuery<T>, sort?: any, limit?: number, skip?: number, populate?: any): Promise<T[]>;
  update(id: string, item: UpdateQuery<T>, options?: QueryOptions): Promise<T | null>;
  delete(id: string): Promise<T | null>;
  count(filter?: FilterQuery<T>): Promise<number>;
}

export abstract class BaseRepository<T extends Document> implements IBaseRepository<T> {
  protected readonly _model: Model<T>;

  constructor(model: Model<T>) {
    this._model = model;
  }

  async create(item: Partial<T>): Promise<T> {
    return await this._model.create(item);
  }

  async findById(id: string, populate?: any): Promise<T | null> {
    let query = this._model.findById(id);
    if (populate) query = query.populate(populate);
    return await query.exec();
  }

  async findOne(filter: FilterQuery<T>, populate?: any): Promise<T | null> {
    let query = this._model.findOne(filter);
    if (populate) query = query.populate(populate);
    return await query.exec();
  }

  async find(
    filter: FilterQuery<T> = {},
    sort: any = { createdAt: -1 },
    limit?: number,
    skip?: number,
    populate?: any
  ): Promise<T[]> {
    let query = this._model.find(filter).sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    if (populate) query = query.populate(populate);
    return await query.exec();
  }

  async update(id: string, item: UpdateQuery<T>, options: QueryOptions = { new: true }): Promise<T | null> {
    return await this._model.findByIdAndUpdate(id, item, options).exec();
  }

  async delete(id: string): Promise<T | null> {
    return await this._model.findByIdAndDelete(id).exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return await this._model.countDocuments(filter).exec();
  }
}
