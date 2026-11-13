export type AdoptablePet = {
  id: string;
  name: string;
  age: string;
  species: "dog" | "cat" | "other";
  breed: string;
  sex: "male" | "female" | "unknown";
  size: "small" | "medium" | "large";
  vaccinated: boolean;
  sterilized: boolean;
  description: string;
  photos: string[];
};
