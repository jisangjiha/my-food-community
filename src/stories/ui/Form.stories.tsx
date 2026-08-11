import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Checkbox } from "../../components/ui/Checkbox";
import { Chip } from "../../components/ui/Chip";
import { Dropzone, FileItem } from "../../components/ui/FileUploader";
import { Radio, RadioGroup } from "../../components/ui/Radio";
import { Select, SelectItem } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { TextArea } from "../../components/ui/TextArea";
import { TextField } from "../../components/ui/TextField";
import type { FieldSize } from "../../components/ui/field";
import { Gallery, Matrix, Specimen } from "../lib/Matrix";

const FIELD_STATES = ["default", "focused", "disabled", "error"] as const;
const FIELD_SIZE_LIST: FieldSize[] = ["lg", "md", "sm"];

type FieldState = (typeof FIELD_STATES)[number];

function fieldProps(state: FieldState) {
  return {
    disabled: state === "disabled",
    forceFocused: state === "focused",
    error: state === "error" ? "필수 입력 항목입니다" : undefined,
  };
}

const meta = {
  title: "UI/Form",
  parameters: {
    docs: {
      description: {
        component:
          "10-ds-ui-component-form.txt의 9개 컴포넌트입니다. 각 스토리는 타입(행) × 상태(열) 배치를 따릅니다. " +
          "`focused`는 실제로는 `:focus-within`으로 동작하며, 매트릭스에서만 `forceFocused`로 고정해 보여줍니다.",
      },
    },
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** text / password × 4 states. */
export const TextFields: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="TextField — 타입 × 상태 (md)"
        columns={[...FIELD_STATES]}
        rows={["text", "password"]}
        render={(type, state) => (
          <div className="w-[210px]">
            <TextField
              type={type as "text" | "password"}
              label={type === "text" ? "이메일" : "비밀번호"}
              placeholder="입력하세요"
              helperText="도움말 텍스트"
              leadingIcon={type === "text" ? "search" : undefined}
              {...fieldProps(state as FieldState)}
            />
          </div>
        )}
      />
      <Matrix
        title="TextField — 사이즈"
        columns={["아이콘 없음", "좌측 아이콘", "양쪽 아이콘"]}
        rows={FIELD_SIZE_LIST}
        render={(size, variant) => (
          <div className="w-[210px]">
            <TextField
              size={size as FieldSize}
              placeholder="입력하세요"
              leadingIcon={variant === "아이콘 없음" ? undefined : "search"}
              trailingIcon={variant === "양쪽 아이콘" ? "close" : undefined}
            />
          </div>
        )}
      />
    </Gallery>
  ),
};

/** Fixed 3-line box with an optional counter. */
export const TextAreas: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="TextArea — 상태"
        columns={[...FIELD_STATES]}
        rows={["default"]}
        rowLabel={() => ""}
        render={(_row, state) => (
          <div className="w-[230px]">
            <TextArea
              label="후기"
              placeholder="내용을 입력하세요"
              helperText="도움말 텍스트"
              showCounter
              maxLength={200}
              defaultValue={
                state === "error" || state === "focused"
                  ? "차로 가기 좋은 조용한 골목 맛집이에요."
                  : ""
              }
              disabled={state === "disabled"}
              forceFocused={state === "focused"}
              error={state === "error" ? "20자 이상 입력해 주세요" : undefined}
            />
          </div>
        )}
      />
    </Gallery>
  ),
};

/** Selection (row) × state (column), for both sizes. */
export const Checkboxes: Story = {
  render: () => (
    <Gallery>
      {(["md", "sm"] as const).map((size) => (
        <Matrix
          key={size}
          title={`Checkbox — ${size} (${size === "md" ? 20 : 16})`}
          columns={["default", "disabled", "error"]}
          rows={["unchecked", "checked", "indeterminate"]}
          render={(selection, state) => (
            <Checkbox
              size={size}
              checked={selection === "checked"}
              indeterminate={selection === "indeterminate"}
              disabled={state === "disabled"}
              invalid={state === "error"}
            >
              동의합니다
            </Checkbox>
          )}
        />
      ))}
      <Specimen
        label="그룹 사용"
        description="에러 메시지는 그룹 아래에 한 번만 표시합니다."
      >
        <div className="flex flex-col gap-2">
          <Checkbox invalid>이용약관 동의 (필수)</Checkbox>
          <Checkbox invalid>개인정보 처리방침 동의 (필수)</Checkbox>
          <Checkbox>마케팅 수신 동의 (선택)</Checkbox>
          <p className="type-label-md text-text-error">
            필수 항목에 모두 동의해 주세요
          </p>
        </div>
      </Specimen>
    </Gallery>
  ),
};

/** Radios are never used alone — always inside a group. */
export const Radios: Story = {
  render: () => (
    <Gallery>
      {(["md", "sm"] as const).map((size) => (
        <Matrix
          key={size}
          title={`Radio — ${size} (${size === "md" ? 20 : 16})`}
          columns={["default", "disabled"]}
          rows={["unselected", "selected"]}
          render={(selection, state) => (
            <Radio
              size={size}
              checked={selection === "selected"}
              disabled={state === "disabled"}
            >
              옵션 선택
            </Radio>
          )}
        />
      ))}
      <Specimen label="그룹 사용" description="단독 사용 금지">
        <RadioGroup
          label="정렬 기준"
          name="sort"
          value="distance"
          options={[
            { value: "distance", label: "거리순" },
            { value: "rating", label: "평점순" },
            { value: "recent", label: "최신순", disabled: true },
          ]}
        />
      </Specimen>
    </Gallery>
  ),
};

export const Switches: Story = {
  render: () => (
    <Gallery>
      {(["md", "sm"] as const).map((size) => (
        <Matrix
          key={size}
          title={`Switch — ${size} (${size === "md" ? "40×20" : "32×16"})`}
          columns={["default", "disabled"]}
          rows={["off", "on"]}
          render={(selection, state) => (
            <Switch
              size={size}
              checked={selection === "on"}
              disabled={state === "disabled"}
            >
              알림 받기
            </Switch>
          )}
        />
      ))}
    </Gallery>
  ),
};

export const Selects: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="Select — 상태"
        columns={[...FIELD_STATES]}
        rows={["default"]}
        rowLabel={() => ""}
        render={(_row, state) => (
          <div className="w-[200px]">
            <Select
              label="카테고리"
              helperText="도움말 텍스트"
              value={state === "default" ? undefined : "한식"}
              disabled={state === "disabled"}
              open={state === "focused"}
              error={state === "error" ? "카테고리를 선택해 주세요" : undefined}
            />
          </div>
        )}
      />
      <Specimen
        label="열린 패널"
        description="focused는 패널이 열려 있는 동안 유지됩니다."
      >
        <div className="flex w-[200px] flex-col gap-1">
          <Select label="카테고리" value="한식" open listboxId="category-listbox" />
          <div
            id="category-listbox"
            className="rounded-xl border border-border-default bg-background-surface p-1.5"
            role="listbox"
            aria-label="카테고리"
          >
            <SelectItem selected>한식</SelectItem>
            <SelectItem>중식</SelectItem>
            <SelectItem>일식</SelectItem>
            <SelectItem disabled>양식 (준비 중)</SelectItem>
          </div>
        </div>
      </Specimen>
      <Matrix
        title="SelectItem — 상태 × 사이즈"
        columns={["default", "selected", "disabled"]}
        rows={FIELD_SIZE_LIST}
        render={(size, state) => (
          // role="option" is only valid inside a listbox.
          <div
            role="listbox"
            aria-label={`${size} ${state}`}
            className="w-[160px] rounded-lg border border-border-default bg-background-surface p-1"
          >
            <SelectItem
              size={size as FieldSize}
              selected={state === "selected"}
              disabled={state === "disabled"}
            >
              한식
            </SelectItem>
          </div>
        )}
      />
    </Gallery>
  ),
};

export const Chips: Story = {
  render: () => (
    <Gallery>
      {(["md", "sm"] as const).map((size) => (
        <Matrix
          key={size}
          title={`Chip — ${size} (${size === "md" ? 32 : 24})`}
          columns={["default", "disabled"]}
          rows={["unselected", "selected"]}
          render={(selection, state) => (
            <Chip
              size={size}
              selected={selection === "selected"}
              disabled={state === "disabled"}
            >
              한식
            </Chip>
          )}
        />
      ))}
      <Specimen
        label="좌측 아이콘"
        description="아이콘이 있으면 좌우 패딩이 md 8 / sm 6으로 좁아집니다."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip leadingIcon="check" selected>
            한식
          </Chip>
          <Chip leadingIcon="star">평점순</Chip>
          <Chip size="sm" leadingIcon="check" selected>
            한식
          </Chip>
          <Chip size="sm" leadingIcon="star">
            평점순
          </Chip>
        </div>
      </Specimen>
    </Gallery>
  ),
};

export const FileUpload: Story = {
  render: () => (
    <Gallery>
      <Matrix
        title="Dropzone — 상태"
        columns={["default", "dragover", "disabled", "error"]}
        rows={["dropzone"]}
        rowLabel={() => ""}
        render={(_row, state) => (
          <div className="w-[240px]">
            <Dropzone
              state={state as "default" | "dragover" | "disabled" | "error"}
              helperText="JPG, PNG · 최대 5MB"
              guideText={
                state === "error" ? "업로드에 실패했어요" : "끌어다 놓거나"
              }
            />
          </div>
        )}
      />
      <Matrix
        title="FileItem — 상태"
        columns={["uploading", "complete", "error"]}
        rows={["item"]}
        rowLabel={() => ""}
        render={(_row, state) => (
          <div className="w-[320px]">
            <FileItem
              name="food-photo.jpg"
              state={state as "uploading" | "complete" | "error"}
              status={state === "uploading" ? "업로드 중 · 40%" : undefined}
            />
          </div>
        )}
      />
      <Specimen label="결합 사용" description="드롭존 + 파일 아이템 리스트">
        <div className="flex w-[320px] flex-col gap-3">
          <Dropzone helperText="JPG, PNG · 최대 5MB" />
          <div className="flex flex-col gap-2">
            <FileItem name="food-photo.jpg" state="complete" />
            <FileItem
              name="interior.png"
              state="uploading"
              status="업로드 중 · 40%"
            />
            <FileItem name="menu.pdf" state="error" />
          </div>
        </div>
      </Specimen>
      <Specimen
        label="실제 파일 선택"
        description="accept·multiple·onFilesSelected를 주면 진짜 파일 대화상자가 열립니다. 고른 파일 이름이 콘솔에 찍힙니다."
      >
        <div className="w-[320px]">
          <Dropzone
            helperText="JPG, PNG · 최대 5MB"
            accept="image/jpeg,image/png"
            multiple
            onFilesSelected={(files) =>
              console.log(
                "[Dropzone] 선택한 파일",
                files.map((file) => file.name),
              )
            }
          />
        </div>
      </Specimen>
    </Gallery>
  ),
};
