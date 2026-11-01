"""Request bodies (responses are plain dicts documented in the README)."""
from pydantic import BaseModel, Field


class RatingIn(BaseModel):
    user_id: int
    movie_id: int
    rating: float = Field(ge=0.5, le=5.0, multiple_of=0.5)
    model: str = "hybrid"          # which model to use for the refreshed recs
    k: int = Field(12, ge=1, le=50)


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    genres: list[str] = []
    favorite_movie_ids: list[int] = []   # onboarding picks, stored as 5-star ratings


class DemoUserCreate(BaseModel):
    movielens_user_id: int


class MoodIn(BaseModel):
    mood: str = "happy"
    genres: list[str] = []
    company: str = "solo"
    era: str = "any"
    runtime: str = "any"
    discovery: str = "balanced"
    text: str = Field("", max_length=120)
    user_id: int | None = None
    k: int = Field(12, ge=1, le=30)
    exclude: list[int] = Field(default_factory=list, max_length=300)   # ids already shown
    seed: int | None = None                                            # varies the picks


class WatchlistIn(BaseModel):
    movie_id: int
    on: bool = True
