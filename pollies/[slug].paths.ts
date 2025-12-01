import { loadPollies } from "../data/pollies.data";

export default {
  paths() {
    const pollies = loadPollies();
    return pollies.map((pollie) => ({
      params: {
        slug: pollie.slug,
        name: pollie.name,
        division: pollie.division,
        state: pollie.state,
        party: pollie.party,
        stillInOffice: pollie.stillInOffice,
        reason: pollie.reason,
        ceasedDate: pollie.ceasedDate,
      },
    }));
  },
};
