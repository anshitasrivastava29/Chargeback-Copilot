from pydantic import EmailStr, Field

from app.schemas.dispute import CamelModel


class SignupRequest(CamelModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str | None = Field(default=None, max_length=160)


class LoginRequest(CamelModel):
    email: EmailStr
    password: str


class UserOut(CamelModel):
    id: int
    email: str
    name: str
    business_name: str


class AuthResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
