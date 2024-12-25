import type { StandardSchemaV1 } from '@standard-schema/spec';
import { z } from 'zod';

interface IValidationAdapter {
	buildValidator: typeof buildValidator;
}

function createValidationAdapter(): IValidationAdapter {
	return {
		buildValidator,
	};
}

// Step 1: Define the schema generic
function buildValidator<TSchema extends StandardSchemaV1, TOutput>(
	// Step 2: Use the generic to accept a schema
	schema: TSchema,
	// Step 3: Infer the output type from the generic
	handler: (data: StandardSchemaV1.InferOutput<TSchema>) => Promise<TOutput>,
) {
	return {
		async validate(data: unknown) {
			// Step 4: Use the schema to validate data
			const result = await schema['~standard'].validate(data);

			// Step 5: Process the validation result
			if (result.issues) {
				throw new Error(result.issues[0].message ?? 'Validation failed');
			}
			return handler(result.value);
		},
	};
}

export { createValidationAdapter, z };
export type { IValidationAdapter };
