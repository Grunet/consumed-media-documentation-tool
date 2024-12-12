import { IAnimeIdentityService } from './animeIdentity';

interface IServiceRegistry {
	getAnimeIdentityService(): IAnimeIdentityService;
}

class ServiceRegistry implements IServiceRegistry {
	#animeIdentityService: IAnimeIdentityService;

	constructor({ animeIdentityService }: { animeIdentityService: IAnimeIdentityService }) {
		this.#animeIdentityService = animeIdentityService;
	}

	getAnimeIdentityService(): IAnimeIdentityService {
		return this.#animeIdentityService;
	}
}

interface ICreateServiceRegistryInputs {
	services: {
		animeIdentityService: IAnimeIdentityService;
	};
}

function createServiceRegistry(inputs: ICreateServiceRegistryInputs): IServiceRegistry {
	return new ServiceRegistry(inputs.services);
}

export { createServiceRegistry };
